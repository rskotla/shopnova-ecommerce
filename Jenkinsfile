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

        stage('Update GitOps Manifests') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'github-repo-write',
                        usernameVariable: 'GIT_USERNAME',
                        passwordVariable: 'GIT_PASSWORD'
                    )
                ]) {
                    sh '''
                        set -eu

                        python3 - "$IMAGE_TAG" <<'PYTAG'
from pathlib import Path
import re
import sys

tag = sys.argv[1]
if not tag.isdigit():
    raise SystemExit("Invalid image tag")

for filename, image in [
    ("k8s/api.yaml", "rohitkotla/shopnova-api"),
    ("k8s/web.yaml", "rohitkotla/shopnova-web"),
]:
    path = Path(filename)
    content = path.read_text()
    pattern = r"(^\s*image:\s*)" + re.escape(image) + r":[^\s]+"
    updated, count = re.subn(
        pattern, lambda match: match.group(1) + image + ":" + tag,
        content, flags=re.MULTILINE
    )
    if count != 1:
        raise SystemExit(f"Expected one image entry in {filename}; found {count}")
    path.write_text(updated)
PYTAG

                        git diff --check

                        EXPECTED_COMMIT="$(git rev-parse HEAD)"
                        git fetch origin develop
                        REMOTE_COMMIT="$(git rev-parse refs/remotes/origin/develop)"

                        if [ "$REMOTE_COMMIT" != "$EXPECTED_COMMIT" ]; then
                            echo "ERROR: origin/develop changed after this build's checkout."
                            echo "Expected: $EXPECTED_COMMIT"
                            echo "Remote:   $REMOTE_COMMIT"
                            echo "Aborting GitOps update. Review and rebuild."
                            exit 1
                        fi

                        git add k8s/api.yaml k8s/web.yaml

                        if git diff --cached --quiet; then
                            echo "No manifest changes to commit."
                            exit 0
                        fi

                        git config user.name "jenkins-shopnova"
                        git config user.email "jenkins-shopnova@users.noreply.github.com"
                        git commit -m "Update ShopNova images to release $IMAGE_TAG [skip ci]"

                        ASKPASS="$(mktemp)"
                        trap 'rm -f "$ASKPASS"' EXIT
                        cat > "$ASKPASS" <<'ASKPASS_SCRIPT'
#!/bin/sh
case "$1" in
    *Username*) printf '%s\n' "$GIT_USERNAME" ;;
    *Password*) printf '%s\n' "$GIT_PASSWORD" ;;
    *) exit 1 ;;
esac
ASKPASS_SCRIPT
                        chmod 700 "$ASKPASS"

                        GIT_ASKPASS="$ASKPASS" \
                        GIT_TERMINAL_PROMPT=0 \
                          git push https://github.com/rskotla/shopnova-ecommerce.git HEAD:develop

                        echo "GitOps manifests pushed. Argo CD manual sync is required."
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
