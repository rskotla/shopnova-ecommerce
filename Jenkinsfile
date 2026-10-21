
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
    }

    post {
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
