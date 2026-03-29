FROM hapiproject/hapi:v7.4.0

# Database connection
# For Cloud Run: uses Cloud SQL socket at /cloudsql/<CONNECTION_NAME>
# For local dev: override spring.datasource.url to jdbc:postgresql://localhost:5432/hapi_fhir
# URL is overridden at deploy time via --set-env-vars; default for local dev
ENV spring.datasource.url=jdbc:postgresql://localhost:5432/hapi_fhir
ENV spring.datasource.username=fhir_user
ENV spring.datasource.driverClassName=org.postgresql.Driver
ENV spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect

# HAPI FHIR configuration
ENV hapi.fhir.allow_multiple_delete=true
ENV hapi.fhir.allow_external_references=true
ENV hapi.fhir.cors.allowed_origin_patterns=*
ENV hapi.fhir.cors.allow_credentials=true
ENV hapi.fhir.enable_index_missing_fields=true
ENV hapi.fhir.tester.home.server_address=http://localhost:8080/fhir
