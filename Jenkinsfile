pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        DOCKER_HOST_IP = '192.168.1.32'
        REGISTRY_USER  = 'rohitkotla'
        API_IMAGE      = 'rohitkotla/shopnova-api'
        WEB_IMAGE      = 'rohitkotla/shopnova-web'
        IMAGE_TAG      = "${BUILD_NUMBER}"
        REMOTE_DIR     = "/tmp/shopnova-ecommerce-${BUILD_NUMBER}"
        K8S_NAMESPACE  = 'shopnova'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh '''
                    set -eu
                    test -f backend/app.py
                    test -f backend/requirements.txt
                    test -f frontend/Dockerfile
                    test -f backend/Dockerfile
                    test -f tests/test_api_smoke.py
                    echo "Repository structure verified."
                '''
            }
        }

        stage('API Tests') {
            steps {
                sh '''
                    set -eu
                    python3 --version
                    python3 -m venv .venv-ci
                    . .venv-ci/bin/activate
                    python -m pip install --upgrade pip
                    pip install -r backend/requirements.txt pytest
                    python -m py_compile backend/app.py
                    PYTHONPATH="$WORKSPACE" pytest -q tests/test_api_smoke.py
                '''
            }
        }

        stage('Transfer Source and Build Images') {
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'shopnova-docker-ssh',
                        keyFileVariable: 'SSH_KEY',
                        usernameVariable: 'SSH_USER'
                    )
                ]) {
                    sh '''
                        set -eu

                        SSH_OPTS="-i $SSH_KEY -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/var/lib/jenkins/.ssh/known_hosts"

                        tar \
                          --exclude=.git \
                          --exclude=.venv-ci \
                          --exclude=.env \
                          --exclude=Jenkinsfile.backup \
                          -czf - . |
                          ssh $SSH_OPTS "$SSH_USER@$DOCKER_HOST_IP" \
                          "mkdir -p '$REMOTE_DIR' && tar -xzf - -C '$REMOTE_DIR'"

                        ssh $SSH_OPTS "$SSH_USER@$DOCKER_HOST_IP" \
                          "cd '$REMOTE_DIR' && docker build -t '$API_IMAGE:$IMAGE_TAG' ./backend && docker build -t '$WEB_IMAGE:$IMAGE_TAG' ./frontend"
                    '''
                }
            }
        }

        stage('Trivy Image Scan') {
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'shopnova-docker-ssh',
                        keyFileVariable: 'SSH_KEY',
                        usernameVariable: 'SSH_USER'
                    )
                ]) {
                    sh '''
                        set -eu
                        SSH_OPTS="-i $SSH_KEY -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/var/lib/jenkins/.ssh/known_hosts"

                        ssh $SSH_OPTS "$SSH_USER@$DOCKER_HOST_IP" \
                          "trivy image --download-db-only"

                        ssh $SSH_OPTS "$SSH_USER@$DOCKER_HOST_IP" \
                          "trivy image --exit-code 1 --severity HIGH,CRITICAL '$API_IMAGE:$IMAGE_TAG'"

                        ssh $SSH_OPTS "$SSH_USER@$DOCKER_HOST_IP" \
                          "trivy image --exit-code 1 --severity HIGH,CRITICAL '$WEB_IMAGE:$IMAGE_TAG'"
                    '''
                }
            }
        }

        stage('Push Images to Docker Hub') {
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'shopnova-docker-ssh',
                        keyFileVariable: 'SSH_KEY',
                        usernameVariable: 'SSH_USER'
                    ),
                    usernamePassword(
                        credentialsId: 'docker-hub-creds',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASSWORD'
                    )
                ]) {
                    sh '''
                        set -eu
                        SSH_OPTS="-i $SSH_KEY -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/var/lib/jenkins/.ssh/known_hosts"

                        printf '%s' "$DOCKER_PASSWORD" |
                          ssh $SSH_OPTS "$SSH_USER@$DOCKER_HOST_IP" \
                          "docker login -u '$DOCKER_USER' --password-stdin"

                        ssh $SSH_OPTS "$SSH_USER@$DOCKER_HOST_IP" \
                          "docker push '$API_IMAGE:$IMAGE_TAG' && docker push '$WEB_IMAGE:$IMAGE_TAG'"

                        ssh $SSH_OPTS "$SSH_USER@$DOCKER_HOST_IP" \
                          "docker logout"
                    '''
                }
            }
        }

        stage('Deploy to K3s') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'shopnova-kubeconfig',
                        variable: 'KUBECONFIG'
                    )
                ]) {
                    sh '''
                        set -eu

                        echo "Checking kubectl availability..."
                        command -v kubectl

                        echo "Checking ShopNova deployment permissions..."
                        kubectl auth can-i patch deployments -n "$K8S_NAMESPACE"

                        echo "Deploying API image: $API_IMAGE:$IMAGE_TAG"
                        kubectl -n "$K8S_NAMESPACE" set image \
                          deployment/shopnova-api \
                          api="$API_IMAGE:$IMAGE_TAG"

                        echo "Deploying Web image: $WEB_IMAGE:$IMAGE_TAG"
                        kubectl -n "$K8S_NAMESPACE" set image \
                          deployment/shopnova-web \
                          web="$WEB_IMAGE:$IMAGE_TAG"

                        echo "Waiting for API rollout..."
                        kubectl -n "$K8S_NAMESPACE" rollout status \
                          deployment/shopnova-api --timeout=180s

                        echo "Waiting for Web rollout..."
                        kubectl -n "$K8S_NAMESPACE" rollout status \
                          deployment/shopnova-web --timeout=180s

                        echo "Verifying deployed images and replicas..."
                        kubectl -n "$K8S_NAMESPACE" get deployments \
                          shopnova-api shopnova-web \
                          -o custom-columns='NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image,READY:.status.readyReplicas'

                        echo "ShopNova deployment completed successfully."
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'ShopNova CI/CD pipeline completed successfully.'
        }

        failure {
            echo 'Pipeline failed. Review the failed stage and Jenkins console log.'
        }

        always {
            sh 'rm -rf .venv-ci || true'

            script {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'shopnova-docker-ssh',
                        keyFileVariable: 'SSH_KEY',
                        usernameVariable: 'SSH_USER'
                    )
                ]) {
                    sh '''
                        SSH_OPTS="-i $SSH_KEY -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/var/lib/jenkins/.ssh/known_hosts"

                        ssh $SSH_OPTS "$SSH_USER@$DOCKER_HOST_IP" \
                          "rm -rf '$REMOTE_DIR'" || true
                    '''
                }
            }
        }
    }
}
