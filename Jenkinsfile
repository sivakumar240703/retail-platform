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
            description: 'Use YES for rollback demonstration'
        )
    }

    environment {

        DOCKER_EXE = 'C:\\Users\\Administrator\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe'

        APP_NAME = 'retail-app'
        NETWORK_NAME = 'retail-network'

        PROD_CONTAINER = 'retail-app-prod'
        CANDIDATE_CONTAINER = 'retail-app-candidate'
        PREVIOUS_CONTAINER = 'retail-app-previous'

        PROD_PORT = '8081'
        CANDIDATE_PORT = '8082'

        ROLLBACK_REQUIRED = 'NO'
        RELEASE_COMMIT = ''
        PREVIOUS_IMAGE = ''
    }

    stages {

        stage('Validate Parameters') {

            steps {

                script {

                    echo "========================================"
                    echo "DEPLOYMENT ACTION : ${params.DEPLOYMENT_ACTION}"
                    echo "ENVIRONMENT       : ${params.ENVIRONMENT}"
                    echo "VERSION           : ${params.VERSION}"
                    echo "CONFIRM_PROD      : ${params.CONFIRM_PROD}"
                    echo "FORCE HEALTH FAIL : ${params.FORCE_HEALTH_FAILURE}"
                    echo "========================================"

                    if (
                        params.ENVIRONMENT == 'PRODUCTION' &&
                        params.CONFIRM_PROD != 'YES'
                    ) {
                        error(
                            "PRODUCTION deployment BLOCKED. " +
                            "CONFIRM_PROD must be YES."
                        )
                    }

                    if (
                        params.DEPLOYMENT_ACTION == 'ROLLBACK' &&
                        params.ENVIRONMENT != 'PRODUCTION'
                    ) {
                        error(
                            "ROLLBACK is allowed only for PRODUCTION."
                        )
                    }
                }
            }
        }

        stage('Git Validation') {

            when {
                expression {
                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {

                script {

                    echo "========================================"
                    echo "Git Release Validation"
                    echo "========================================"

                    bat 'git fetch --tags --force'

                    def tagName = "v${params.VERSION}"

                    echo "Checking Git tag: ${tagName}"

                    /*
                     * Get the commit SHA connected to the tag.
                     * PowerShell is used instead of BAT output capture.
                     */

                    def tagCommitOutput = powershell(
                        returnStdout: true,
                        script: """
                            \$ErrorActionPreference = 'Stop'
                            git rev-parse "${tagName}^{commit}"
                        """
                    ).trim()

                    def tagCommit = tagCommitOutput
                        .readLines()
                        .collect { line -> line.trim() }
                        .find { line ->
                            line ==~ /^[0-9a-fA-F]{40}$/
                        }

                    if (!tagCommit) {

                        error(
                            "Git tag ${tagName} does not exist or " +
                            "its commit could not be determined. " +
                            "Git output: ${tagCommitOutput}"
                        )
                    }

                    env.RELEASE_COMMIT = tagCommit

                    echo "========================================"
                    echo "Git Validation Successful"
                    echo "Validated Git Tag  : ${tagName}"
                    echo "Release Git Commit : ${env.RELEASE_COMMIT}"
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

                    def imageName =
                        "${APP_NAME}:${params.VERSION}"

                    echo "========================================"
                    echo "Docker Build"
                    echo "Image: ${imageName}"
                    echo "========================================"

                    withCredentials([
                        string(
                            credentialsId: 'retail-app-secret',
                            variable: 'APP_SECRET'
                        )
                    ]) {

                        bat """
                            "%DOCKER_EXE%" version

                            "%DOCKER_EXE%" build ^
                            -t ${imageName} .
                        """
                    }

                    bat """
                        "%DOCKER_EXE%" image inspect ${imageName}
                    """

                    echo "Docker image build successful."
                }
            }
        }

        stage('Prepare Network') {

            steps {

                script {

                    echo "Preparing Docker network..."

                    bat """
                        "%DOCKER_EXE%" network inspect ${NETWORK_NAME} >nul 2>&1

                        if errorlevel 1 (
                            "%DOCKER_EXE%" network create ${NETWORK_NAME}
                        )
                    """

                    echo "Docker network ready: ${NETWORK_NAME}"
                }
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

                    echo "Checking existing production container..."

                    def containersOutput = powershell(
                        returnStdout: true,
                        script: """
                            & "\${env:DOCKER_EXE}" ps -a --format "{{.Names}}"
                        """
                    ).trim()

                    def containerList = containersOutput
                        ? containersOutput
                            .readLines()
                            .collect { it.trim() }
                            .findAll { it }
                        : []

                    if (containerList.contains(env.PROD_CONTAINER)) {

                        echo "Previous production container found."

                        env.PREVIOUS_IMAGE = powershell(
                            returnStdout: true,
                            script: """
                                & "\${env:DOCKER_EXE}" inspect ${PROD_CONTAINER} --format="{{.Config.Image}}"
                            """
                        ).trim()

                        echo "Previous production image: ${env.PREVIOUS_IMAGE}"

                        bat """
                            "%DOCKER_EXE%" rm -f ${PREVIOUS_CONTAINER} >nul 2>&1

                            if errorlevel 1 (
                                exit /b 0
                            )
                        """

                        bat """
                            "%DOCKER_EXE%" stop ${PROD_CONTAINER} >nul 2>&1

                            if errorlevel 1 (
                                exit /b 0
                            )
                        """

                        bat """
                            "%DOCKER_EXE%" rename ${PROD_CONTAINER} ${PREVIOUS_CONTAINER}
                        """

                        env.ROLLBACK_REQUIRED = 'YES'

                        echo "Previous production preserved."
                        echo "Automatic rollback is available."

                    } else {

                        echo "No previous production container found."

                        env.PREVIOUS_IMAGE = ''
                        env.ROLLBACK_REQUIRED = 'NO'
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

                    def imageName =
                        "${APP_NAME}:${params.VERSION}"

                    def healthStatus =
                        params.FORCE_HEALTH_FAILURE == 'YES'
                        ? 'fail'
                        : 'healthy'

                    echo "========================================"
                    echo "Deploy Candidate"
                    echo "Candidate image : ${imageName}"
                    echo "Candidate port  : ${CANDIDATE_PORT}"
                    echo "Health mode     : ${healthStatus}"
                    echo "Git commit      : ${env.RELEASE_COMMIT}"
                    echo "========================================"

                    bat """
                        "%DOCKER_EXE%" rm -f ${CANDIDATE_CONTAINER} >nul 2>&1

                        if errorlevel 1 (
                            exit /b 0
                        )
                    """

                    bat """
                        "%DOCKER_EXE%" run -d ^
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

                    echo "Candidate container started successfully."
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

                    echo "========================================"
                    echo "Candidate Health Check"
                    echo "========================================"

                    echo "Waiting for Docker HEALTHCHECK..."

                    bat 'ping 127.0.0.1 -n 21 >nul'

                    /*
                     * IMPORTANT:
                     * PowerShell stores only the final Docker status.
                     * Select-Object -Last 1 prevents command-output confusion.
                     */

                    def healthOutput = powershell(
                        returnStdout: true,
                        script: """
                            \$status = & "\${env:DOCKER_EXE}" inspect ${CANDIDATE_CONTAINER} --format="{{.State.Health.Status}}"
                            \$status | Select-Object -Last 1
                        """
                    ).trim()

                    def health = healthOutput
                        .readLines()
                        .collect { line -> line.trim() }
                        .find { line ->
                            line in [
                                'starting',
                                'healthy',
                                'unhealthy',
                                'none'
                            ]
                        }

                    if (!health) {
                        health = 'unknown'
                    }

                    echo "Candidate health status: ${health}"

                    if (params.FORCE_HEALTH_FAILURE == 'YES') {

                        echo "Forced health failure enabled."

                        health = 'unhealthy'
                    }

                    if (health != 'healthy') {

                        echo "========================================"
                        echo "HEALTH CHECK FAILED"
                        echo "Candidate version: ${params.VERSION}"
                        echo "Candidate health : ${health}"
                        echo "========================================"

                        error(
                            "Candidate health check failed."
                        )
                    }

                    bat """
                        curl --fail http://localhost:${CANDIDATE_PORT}/health
                    """

                    echo "========================================"
                    echo "Candidate health check PASSED."
                    echo "Candidate version: ${params.VERSION}"
                    echo "Candidate health : ${health}"
                    echo "========================================"
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

                    echo "========================================"
                    echo "Promoting healthy candidate"
                    echo "to production"
                    echo "========================================"

                    bat """
                        "%DOCKER_EXE%" rm -f ${PROD_CONTAINER} >nul 2>&1

                        if errorlevel 1 (
                            exit /b 0
                        )
                    """

                    bat """
                        "%DOCKER_EXE%" run -d ^
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

                    echo "New production container started."

                    bat 'ping 127.0.0.1 -n 16 >nul'

                    def productionHealthOutput = powershell(
                        returnStdout: true,
                        script: """
                            \$status = & "\${env:DOCKER_EXE}" inspect ${PROD_CONTAINER} --format="{{.State.Health.Status}}"
                            \$status | Select-Object -Last 1
                        """
                    ).trim()

                    def productionHealth = productionHealthOutput
                        .readLines()
                        .collect { line -> line.trim() }
                        .find { line ->
                            line in [
                                'starting',
                                'healthy',
                                'unhealthy',
                                'none'
                            ]
                        }

                    if (!productionHealth) {
                        productionHealth = 'unknown'
                    }

                    echo "Production health status: ${productionHealth}"

                    if (productionHealth != 'healthy') {

                        error(
                            "Production health check failed after promotion."
                        )
                    }

                    bat """
                        curl --fail http://localhost:${PROD_PORT}/health
                    """

                    bat """
                        "%DOCKER_EXE%" rm -f ${CANDIDATE_CONTAINER} >nul 2>&1

                        if errorlevel 1 (
                            exit /b 0
                        )
                    """

                    /*
                     * Do not remove PREVIOUS_CONTAINER here if you want
                     * to support manual rollback in a later build.
                     *
                     * The previous container is retained.
                     */

                    env.ROLLBACK_REQUIRED = 'NO'

                    echo "========================================"
                    echo "PRODUCTION DEPLOYMENT SUCCESSFUL"
                    echo "Version : ${params.VERSION}"
                    echo "Commit  : ${env.RELEASE_COMMIT}"
                    echo "========================================"
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

                    echo "========================================"
                    echo "MANUAL ROLLBACK"
                    echo "========================================"

                    bat """
                        "%DOCKER_EXE%" rm -f ${PROD_CONTAINER} >nul 2>&1

                        if errorlevel 1 (
                            exit /b 0
                        )
                    """

                    def containersOutput = powershell(
                        returnStdout: true,
                        script: """
                            & "\${env:DOCKER_EXE}" ps -a --format "{{.Names}}"
                        """
                    ).trim()

                    def containerList = containersOutput
                        ? containersOutput
                            .readLines()
                            .collect { it.trim() }
                            .findAll { it }
                        : []

                    if (!containerList.contains(env.PREVIOUS_CONTAINER)) {

                        error(
                            "Rollback failed: previous production container not found."
                        )
                    }

                    bat """
                        "%DOCKER_EXE%" rename ${PREVIOUS_CONTAINER} ${PROD_CONTAINER}
                    """

                    bat """
                        "%DOCKER_EXE%" start ${PROD_CONTAINER}
                    """

                    bat 'ping 127.0.0.1 -n 16 >nul'

                    def rollbackHealthOutput = powershell(
                        returnStdout: true,
                        script: """
                            \$status = & "\${env:DOCKER_EXE}" inspect ${PROD_CONTAINER} --format="{{.State.Health.Status}}"
                            \$status | Select-Object -Last 1
                        """
                    ).trim()

                    def rollbackHealth = rollbackHealthOutput
                        .readLines()
                        .collect { line -> line.trim() }
                        .find { line ->
                            line in [
                                'starting',
                                'healthy',
                                'unhealthy',
                                'none'
                            ]
                        }

                    if (!rollbackHealth) {
                        rollbackHealth = 'unknown'
                    }

                    echo "Rollback health: ${rollbackHealth}"

                    if (rollbackHealth != 'healthy') {

                        error(
                            "ROLLBACK FAILED."
                        )
                    }

                    bat """
                        curl --fail http://localhost:${PROD_PORT}/health
                    """

                    echo "========================================"
                    echo "MANUAL ROLLBACK SUCCESSFUL"
                    echo "Final container: ${PROD_CONTAINER}"
                    echo "Health         : healthy"
                    echo "========================================"
                }
            }
        }
    }

    post {

        failure {

            script {

                if (
                    env.ROLLBACK_REQUIRED == 'YES' &&
                    params.DEPLOYMENT_ACTION == 'DEPLOY' &&
                    params.ENVIRONMENT == 'PRODUCTION'
                ) {

                    echo "========================================"
                    echo "AUTOMATIC ROLLBACK STARTED"
                    echo "========================================"

                    echo "Failed version : ${params.VERSION}"
                    echo "Previous image : ${env.PREVIOUS_IMAGE}"

                    bat """
                        "%DOCKER_EXE%" rm -f ${CANDIDATE_CONTAINER} >nul 2>&1

                        if errorlevel 1 (
                            exit /b 0
                        )
                    """

                    bat """
                        "%DOCKER_EXE%" rm -f ${PROD_CONTAINER} >nul 2>&1

                        if errorlevel 1 (
                            exit /b 0
                        )
                    """

                    def containersOutput = powershell(
                        returnStdout: true,
                        script: """
                            & "\${env:DOCKER_EXE}" ps -a --format "{{.Names}}"
                        """
                    ).trim()

                    def containerList = containersOutput
                        ? containersOutput
                            .readLines()
                            .collect { it.trim() }
                            .findAll { it }
                        : []

                    if (containerList.contains(env.PREVIOUS_CONTAINER)) {

                        echo "Previous production container found."
                        echo "Restoring previous version..."

                        bat """
                            "%DOCKER_EXE%" rename ${PREVIOUS_CONTAINER} ${PROD_CONTAINER}
                        """

                        bat """
                            "%DOCKER_EXE%" start ${PROD_CONTAINER}
                        """

                        bat 'ping 127.0.0.1 -n 16 >nul'

                        def rollbackHealthOutput = powershell(
                            returnStdout: true,
                            script: """
                                \$status = & "\${env:DOCKER_EXE}" inspect ${PROD_CONTAINER} --format="{{.State.Health.Status}}"
                                \$status | Select-Object -Last 1
                            """
                        ).trim()

                        def rollbackHealth = rollbackHealthOutput
                            .readLines()
                            .collect { line -> line.trim() }
                            .find { line ->
                                line in [
                                    'starting',
                                    'healthy',
                                    'unhealthy',
                                    'none'
                                ]
                            }

                        if (!rollbackHealth) {
                            rollbackHealth = 'unknown'
                        }

                        echo "Rollback health status: ${rollbackHealth}"

                        if (rollbackHealth == 'healthy') {

                            echo "========================================"
                            echo "AUTOMATIC ROLLBACK SUCCESSFUL"
                            echo "========================================"

                            echo "Previous image : ${env.PREVIOUS_IMAGE}"
                            echo "Final container: ${PROD_CONTAINER}"
                            echo "Final health   : healthy"
                            echo "========================================"

                        } else {

                            echo "========================================"
                            echo "AUTOMATIC ROLLBACK FAILED"
                            echo "Rollback health: ${rollbackHealth}"
                            echo "========================================"
                        }

                    } else {

                        echo "========================================"
                        echo "AUTOMATIC ROLLBACK FAILED"
                        echo "Previous container not found."
                        echo "========================================"
                    }
                }
            }
        }

        success {

            echo "========================================"
            echo "PIPELINE SUCCESS"
            echo "========================================"
        }

        always {

            echo "========================================"
            echo "DEPLOYMENT SUMMARY"
            echo "========================================"

            echo "Action      : ${params.DEPLOYMENT_ACTION}"
            echo "Environment : ${params.ENVIRONMENT}"
            echo "Version     : ${params.VERSION}"
            echo "Git Commit  : ${env.RELEASE_COMMIT}"

            echo "========================================"
        }
    }
}
