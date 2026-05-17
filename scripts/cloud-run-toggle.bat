@echo off
REM =============================================================================
REM Toggle Clinical Trial FHIR Dashboard services on/off in Cloud Run
REM Usage:
REM   cloud-run-toggle.bat stop    - Delete all services (no billing)
REM   cloud-run-toggle.bat start   - Redeploy all services from existing images
REM   cloud-run-toggle.bat status  - Check current state
REM =============================================================================

set REGION=us-west1
set PROJECT_ID=ai-poc-project-483817
set REGISTRY=us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo
set DASHBOARD_URL=https://clinical-trial-dashboard-232355346494.us-west1.run.app
set CORS_ORIGINS=%DASHBOARD_URL%,http://localhost:5173,http://localhost:3000
set CONNECTION_NAME=%PROJECT_ID%:%REGION%:clinical-trial-db

if "%~1"=="" goto status
if /i "%~1"=="stop" goto stop
if /i "%~1"=="start" goto start
if /i "%~1"=="status" goto status
echo Usage: cloud-run-toggle.bat [stop^|start^|status]
exit /b 1

:stop
echo ==^> Deleting all Cloud Run services to stop billing...
echo.
echo     Deleting hapi-fhir-server...
call gcloud run services delete hapi-fhir-server --region %REGION% --quiet 2>nul
echo     Done.
echo.
echo     Deleting clinical-trial-backend...
call gcloud run services delete clinical-trial-backend --region %REGION% --quiet 2>nul
echo     Done.
echo.
echo     Deleting clinical-trial-dashboard...
call gcloud run services delete clinical-trial-dashboard --region %REGION% --quiet 2>nul
echo     Done.
echo.
echo All services deleted. No charges will accrue.
echo Run 'scripts\cloud-run-toggle.bat start' to redeploy.
goto end

:start
echo ==^> Deploying all Cloud Run services from existing images...
echo.
for /f "tokens=*" %%I in ('gcloud sql instances describe clinical-trial-db --project %PROJECT_ID% --format="value(ipAddresses[0].ipAddress)" 2^>nul') do set CLOUD_SQL_PUBLIC_IP=%%I
if "%CLOUD_SQL_PUBLIC_IP%"=="" (
  echo ERROR: Could not determine Cloud SQL public IP for clinical-trial-db.
  echo Set CLOUD_SQL_PUBLIC_IP and rerun: set CLOUD_SQL_PUBLIC_IP=x.x.x.x ^& scripts\cloud-run-toggle.bat start
  exit /b 1
)
set HAPI_ENV_FILE=%TEMP%\clinical-trial-hapi-env.yaml
set BACKEND_ENV_FILE=%TEMP%\clinical-trial-backend-env.yaml
> "%HAPI_ENV_FILE%" echo spring.datasource.url: "jdbc:postgresql://%CLOUD_SQL_PUBLIC_IP%:5432/hapi_fhir"
>> "%HAPI_ENV_FILE%" echo spring.datasource.username: "fhir_user"
>> "%HAPI_ENV_FILE%" echo hapi.fhir.cors.allowed_origin_patterns: "*"
echo     Deploying hapi-fhir-server...
call gcloud run deploy hapi-fhir-server ^
  --image %REGISTRY%/hapi-fhir:latest ^
  --region %REGION% --platform managed --port 8080 ^
  --memory 2Gi --cpu 2 --min-instances 0 --max-instances 2 ^
  --cpu-boost --timeout 600 ^
  --env-vars-file "%HAPI_ENV_FILE%" ^
  --set-secrets "spring.datasource.password=clinical-trial-db-password:latest" ^
  --add-cloudsql-instances "%CONNECTION_NAME%" ^
  --allow-unauthenticated --quiet
echo     hapi-fhir-server deployed.
echo.
echo     Waiting 30s for FHIR server to initialize...
timeout /t 30 /nobreak >nul
echo.
REM Get FHIR URL
for /f "tokens=*" %%U in ('gcloud run services describe hapi-fhir-server --region %REGION% --format="value(status.url)" 2^>nul') do set FHIR_URL=%%U
echo     FHIR server: %FHIR_URL%/fhir
echo.
curl -sf "%FHIR_URL%/fhir/metadata" >nul
> "%BACKEND_ENV_FILE%" echo CT_FHIR_SERVER_URL: "%FHIR_URL%/fhir"
>> "%BACKEND_ENV_FILE%" echo CT_GCS_BUCKET: "ai-poc-project-483817-clinical-uploads"
>> "%BACKEND_ENV_FILE%" echo CT_CORS_ORIGINS: "%CORS_ORIGINS%"
>> "%BACKEND_ENV_FILE%" echo CT_LLM_PROVIDER: "gemini"
>> "%BACKEND_ENV_FILE%" echo CT_GEMINI_MODEL: "gemini-2.5-flash-lite"
>> "%BACKEND_ENV_FILE%" echo CT_ASSISTANT_DEMO_MODE: "false"
echo     Deploying clinical-trial-backend...
call gcloud run deploy clinical-trial-backend ^
  --image %REGISTRY%/backend:latest ^
  --region %REGION% --platform managed --port 8000 ^
  --memory 1Gi --cpu 1 --min-instances 0 --max-instances 2 ^
  --env-vars-file "%BACKEND_ENV_FILE%" ^
  --set-secrets "CT_GEMINI_API_KEY=gemini-api-key:latest" ^
  --allow-unauthenticated --quiet
echo     clinical-trial-backend deployed.
echo.
REM Get Backend URL
for /f "tokens=*" %%U in ('gcloud run services describe clinical-trial-backend --region %REGION% --format="value(status.url)" 2^>nul') do set BACKEND_URL=%%U
echo     Backend: %BACKEND_URL%
echo.
curl -sf "%BACKEND_URL%/health" >nul
curl -sf "%BACKEND_URL%/api/datasets" >nul
curl -sS -D "%TEMP%\clinical-trial-cors-headers.txt" -o nul -H "Origin: %DASHBOARD_URL%" "%BACKEND_URL%/api/datasets" >nul
findstr /C:"access-control-allow-origin: %DASHBOARD_URL%" "%TEMP%\clinical-trial-cors-headers.txt" >nul
echo     Deploying clinical-trial-dashboard...
call gcloud run deploy clinical-trial-dashboard ^
  --image %REGISTRY%/dashboard:latest ^
  --region %REGION% --platform managed --port 80 ^
  --memory 256Mi --cpu 1 --min-instances 0 --max-instances 2 ^
  --set-env-vars "BACKEND_URL=%BACKEND_URL%" ^
  --set-env-vars "DASHBOARD_USER=admin" ^
  --set-env-vars "DASHBOARD_PASSWORD=clinicaltrial2024" ^
  --allow-unauthenticated --quiet
echo     clinical-trial-dashboard deployed.
echo.
REM Get Dashboard URL
for /f "tokens=*" %%U in ('gcloud run services describe clinical-trial-dashboard --region %REGION% --format="value(status.url)" 2^>nul') do set DASHBOARD_URL=%%U
echo =============================================
echo   All services are running!
echo =============================================
echo.
echo   Dashboard:  %DASHBOARD_URL%
echo   Backend:    %BACKEND_URL%
echo   FHIR:       %FHIR_URL%/fhir
echo.
echo   NOTE: FHIR data must be reloaded after restart:
echo   python -m pipeline.load_to_fhir --server-url %FHIR_URL%/fhir --bundle-dir data/fhir_bundles/
goto end

:status
echo ==^> Cloud Run service status:
echo.
for %%S in (hapi-fhir-server clinical-trial-backend clinical-trial-dashboard) do (
    call gcloud run services describe %%S --region %REGION% --format="value(status.url)" 2>nul && (
        echo     %%S    RUNNING
    ) || (
        echo     %%S    NOT DEPLOYED
    )
)
goto end

:end
