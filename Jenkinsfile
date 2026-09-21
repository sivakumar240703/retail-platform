 pipeline {
    agent any

    parameters {
        choice(
            name: 'DEPLOYMENT_ACTION',
            choices: ['DEPLOY', 'ROLLBACK'],
            description: 'Choose deployment action'
        )

        choice(
            name: 'ENVIRONMENT',
            choices: ['UAT', 'PRODUCTION'],
            description: 'Choose deployment environment'
        )

        string(
            name: 'VERSION',
            defaultValue: '4.2.1',
            description: 'Application version'
        )

        choice(
            name: 'CONFIRM_PROD',
            choices: ['NO', 'YES'],
            description: 'Must be YES for production deployment'
        )

        choice(
            name: 'FORCE_HEALTH_FAILURE',
            choices: ['NO', 'YES'],
            description: 'Use YES only for mandatory rollback failure demonstration'
        )
    }

    environment {
        APP_NAME = 'retail-app'
        NETWORK_NAME = 'retail-network'
        PROD_CONTAINER = 'retail-app-prod'
        CANDIDATE_CONTAINER = 'retail-app-candidate'
        PREVIOUS_CONTAINER = 'retail-app-previous'
        PROD_PORT = '8081'
        CANDIDATE_PORT = '8082'
    }

    stages {

        stage('Validate Parameters') {
            steps {
                script {

                    echo "========================================"
                    echo "DEPLOYMENT ACTION : ${params.DEPLOYMENT_ACTION}"
                    echo "ENVIRONMENT        : ${params.ENVIRONMENT}"
                    echo "VERSION            : ${params.VERSION}"
                    echo "CONFIRM_PROD       : ${params.CONFIRM_PROD}"
                    echo "FORCE HEALTH FAIL  : ${params.FORCE_HEALTH_FAILURE}"
                    echo "========================================"

                    if (params.ENVIRONMENT == 'PRODUCTION' &&
                        params.CONFIRM_PROD != 'YES') {

                        error(
                            "PRODUCTION deployment BLOCKED. " +
                            "CONFIRM_PROD must be YES."
                        )
                    }

                    if (params.DEPLOYMENT_ACTION == 'ROLLBACK' &&
                        params.ENVIRONMENT != 'PRODUCTION') {

                        error("ROLLBACK is allowed only for PRODUCTION.")
                    }
                }
            }
        }

        stage('Git Validation') {
            steps {
                script {

                    bat 'git fetch --tags --force'

                    def tagName = "v${params.VERSION}"

                    def commit = bat(
                        script: "git rev-list -n 1 refs/tags/${tagName}",
                        returnStdout: true
                    ).trim()

                    if (!commit) {
                        error("Git tag ${tagName} does not exist.")
                    }

                    env.RELEASE_COMMIT = commit

                    echo "========================================"
                    echo "Git Tag    : ${tagName}"
                    echo "Git Commit : ${env.RELEASE_COMMIT}"
                    echo "========================================"
                }
            }
        }

        stage('Docker Build') {
            when {
                expression {
                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {
                script {

                    def imageName = "${APP_NAME}:${params.VERSION}"

                    echo "Building Docker image: ${imageName}"

                    withCredentials([
                        string(
                            credentialsId: 'retail-app-secret',
                            variable: 'APP_SECRET'
                        )
                    ]) {

                        bat """
                            docker build ^
                            -t ${imageName} ^
                            .
                        """
                    }

                    bat "docker image inspect ${imageName}"

                    echo "Docker image created successfully."
                }
            }
        }

        stage('Prepare Network') {
            steps {
                bat """
                    docker network inspect ${NETWORK_NAME} >nul 2>&1 ^
                    || docker network create ${NETWORK_NAME}
                """
            }
        }

        stage('Record Previous Production') {
            when {
                expression {
                    params.DEPLOYMENT_ACTION == 'DEPLOY' &&
                    params.ENVIRONMENT == 'PRODUCTION'
                }
            }

            steps {
                script {

                    def existing = bat(
                        script: """
                            docker ps -a ^
                            --filter name=^${PROD_CONTAINER}\\$ ^
                            --format "{{.Names}}"
                        """,
                        returnStdout: true
                    ).trim()

                    if (existing) {

                        echo "Previous production container found."

                        env.PREVIOUS_IMAGE = bat(
                            script: """
                                docker inspect ${PROD_CONTAINER} ^
                                --format="{{.Config.Image}}"
                            """,
                            returnStdout: true
                        ).trim()

                        echo "Previous production image: ${env.PREVIOUS_IMAGE}"

                        bat """
                            docker rm -f ${PREVIOUS_CONTAINER} >nul 2>&1 || exit /b 0
                            docker rename ${PROD_CONTAINER} ${PREVIOUS_CONTAINER}
                        """

                    } else {

                        echo "No previous production container found."
                        env.PREVIOUS_IMAGE = ''
                    }
                }
            }
        }

        stage('Deploy Candidate') {
            when {
                expression {
                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {
                script {

                    def imageName = "${APP_NAME}:${params.VERSION}"

                    def healthStatus =
                        params.FORCE_HEALTH_FAILURE == 'YES'
                        ? 'fail'
                        : 'healthy'

                    bat """
                        docker rm -f ${CANDIDATE_CONTAINER} >nul 2>&1 || exit /b 0
                    """

                    echo "Starting candidate container."

                    bat """
                        docker run -d ^
                        --name ${CANDIDATE_CONTAINER} ^
                        --network ${NETWORK_NAME} ^
                        -p ${CANDIDATE_PORT}:8081 ^
                        -e APP_VERSION=${params.VERSION} ^
                        -e GIT_COMMIT=${env.RELEASE_COMMIT} ^
                        -e HEALTH_STATUS=${healthStatus} ^
                        --memory=256m ^
                        --cpus=0.50 ^
                        ${imageName}
                    """

                    echo "Candidate container started."
                }
            }
        }

        stage('Health Check') {
            when {
                expression {
                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {
                script {

                    echo "Waiting for Docker health check..."

                    bat 'timeout /t 20 /nobreak'

                    def health = bat(
                        script: """
                            docker inspect ^
                            --format="{{.State.Health.Status}}" ^
                            ${CANDIDATE_CONTAINER}
                        """,
                        returnStdout: true
                    ).trim()

                    echo "Candidate health status: ${health}"

                    if (health != 'healthy') {
                        error(
                            "HEALTH CHECK FAILED. " +
                            "Candidate status: ${health}"
                        )
                    }

                    bat """
                        curl --fail http://localhost:${CANDIDATE_PORT}/health
                    """

                    echo "Candidate health check PASSED."
                }
            }
        }

        stage('Promote To Production') {
            when {
                expression {
                    params.DEPLOYMENT_ACTION == 'DEPLOY' &&
                    params.ENVIRONMENT == 'PRODUCTION'
                }
            }

            steps {
                script {

                    echo "Promoting healthy candidate to production."

                    bat """
                        docker rm -f ${PROD_CONTAINER} >nul 2>&1 || exit /b 0
                    """

                    bat """
                        docker run -d ^
                        --name ${PROD_CONTAINER} ^
                        --network ${NETWORK_NAME} ^
                        -p ${PROD_PORT}:8081 ^
                        -e APP_VERSION=${params.VERSION} ^
                        -e GIT_COMMIT=${env.RELEASE_COMMIT} ^
                        -e HEALTH_STATUS=healthy ^
                        --memory=256m ^
                        --cpus=0.50 ^
                        ${APP_NAME}:${params.VERSION}
                    """

                    bat """
                        docker rm -f ${CANDIDATE_CONTAINER}
                    """

                    echo "Production deployment completed."
                }
            }
        }

        stage('Manual Rollback') {
            when {
                expression {
                    params.DEPLOYMENT_ACTION == 'ROLLBACK'
                }
            }

            steps {
                script {

                    echo "Starting manual rollback."

                    bat """
                        docker rm -f ${PROD_CONTAINER} >nul 2>&1 || exit /b 0
                    """

                    def previousExists = bat(
                        script: """
                            docker ps -a ^
                            --filter name=^${PREVIOUS_CONTAINER}\\$ ^
                            --format "{{.Names}}"
                        """,
                        returnStdout: true
                    ).trim()

                    if (!previousExists) {
                        error(
                            "Rollback failed: previous production container not found."
                        )
                    }

                    bat """
                        docker rename ${PREVIOUS_CONTAINER} ${PROD_CONTAINER}
                    """

                    bat """
                        docker start ${PROD_CONTAINER}
                    """

                    bat 'timeout /t 15 /nobreak'

                    def rollbackHealth = bat(
                        script: """
                            docker inspect ^
                            --format="{{.State.Health.Status}}" ^
                            ${PROD_CONTAINER}
                        """,
                        returnStdout: true
                    ).trim()

                    echo "Rollback health: ${rollbackHealth}"

                    if (rollbackHealth != 'healthy') {
                        error("ROLLBACK FAILED.")
                    }

                    echo "Manual rollback successful."
                }
            }
        }
    }

    post {

        success {
            echo "========================================"
            echo "PIPELINE SUCCESS"
            echo "========================================"
        }

        failure {
            echo "========================================"
            echo "PIPELINE FAILED"
            echo "========================================"
        }

        always {
            echo "========================================"
            echo "Deployment summary"
            echo "Action      : ${params.DEPLOYMENT_ACTION}"
            echo "Environment : ${params.ENVIRONMENT}"
            echo "Version     : ${params.VERSION}"
            echo "========================================"
        }
    }
}
