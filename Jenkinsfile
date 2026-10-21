pipeline {
  agent any
  environment {
    REGISTRY_USER = 'YOUR_DOCKERHUB_USER'
    API_IMAGE = "${REGISTRY_USER}/shopnova-api"
    WEB_IMAGE = "${REGISTRY_USER}/shopnova-web"
    IMAGE_TAG = "${BUILD_NUMBER}"
  }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Test API') {
      steps {
        sh '''
          python3 -m venv .venv-ci
          . .venv-ci/bin/activate
          pip install -r backend/requirements.txt
          python -m py_compile backend/app.py
        '''
      }
    }
    stage('Build images') {
      steps {
        sh '''
          docker build -t ${API_IMAGE}:${IMAGE_TAG} ./backend
          docker build -t ${WEB_IMAGE}:${IMAGE_TAG} ./frontend
        '''
      }
    }
    stage('Trivy scan') {
      steps {
        sh '''
          trivy image --exit-code 1 --severity HIGH,CRITICAL ${API_IMAGE}:${IMAGE_TAG}
          trivy image --exit-code 1 --severity HIGH,CRITICAL ${WEB_IMAGE}:${IMAGE_TAG}
        '''
      }
    }
    stage('Push images') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials',
          usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASSWORD')]) {
          sh '''
            echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USER" --password-stdin
            docker push ${API_IMAGE}:${IMAGE_TAG}
            docker push ${WEB_IMAGE}:${IMAGE_TAG}
            docker logout
          '''
        }
      }
    }
  }
  post {
    always { sh 'rm -rf .venv-ci || true' }
  }
}
