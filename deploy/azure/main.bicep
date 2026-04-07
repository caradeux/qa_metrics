// ============================================================
// QA Metrics - Infraestructura Azure (Bicep)
// ============================================================
// Crea todos los recursos necesarios:
//   - PostgreSQL Flexible Server
//   - App Service Plan (Linux)
//   - App Service API (Node.js)
//   - App Service Web (Node.js)
// ============================================================

@description('Ubicacion de los recursos')
param location string = resourceGroup().location

@description('Nombre del entorno (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'prod'

@description('SKU del App Service Plan')
param appServicePlanSku string = 'B1'

@description('SKU del PostgreSQL Server')
param postgresSkuName string = 'Standard_B1ms'

@description('Tier del PostgreSQL Server')
param postgresTier string = 'Burstable'

@description('Nombre del administrador de PostgreSQL')
param dbAdminUser string = 'qaadmin'

@secure()
@description('Password del administrador de PostgreSQL')
param dbAdminPassword string

@secure()
@description('JWT Secret para la API')
param jwtSecret string

@secure()
@description('JWT Refresh Secret para la API')
param jwtRefreshSecret string

@secure()
@description('Encryption Key para cifrar tokens ADO')
param encryptionKey string

// ---- Nombres de recursos ----
var prefix = 'qa-metrics'
var suffix = environment == 'prod' ? '' : '-${environment}'
var appServicePlanName = '${prefix}-plan${suffix}'
var apiAppName = '${prefix}-api${suffix}'
var webAppName = '${prefix}-web${suffix}'
var dbServerName = '${prefix}-pgserver${suffix}'
var dbName = 'qa_metrics'

// ---- PostgreSQL Flexible Server ----
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: dbServerName
  location: location
  sku: {
    name: postgresSkuName
    tier: postgresTier
  }
  properties: {
    version: '16'
    administratorLogin: dbAdminUser
    administratorLoginPassword: dbAdminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// ---- Base de datos ----
resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgresServer
  name: dbName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// ---- Firewall: permitir servicios Azure ----
resource firewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ---- App Service Plan ----
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  sku: {
    name: appServicePlanSku
  }
  properties: {
    reserved: true // Linux
  }
}

// ---- Variables compartidas ----
var databaseUrl = 'postgresql://${dbAdminUser}:${dbAdminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${dbName}?sslmode=require&schema=public'

// ---- App Service: API ----
resource apiApp 'Microsoft.Web/sites@2023-12-01' = {
  name: apiAppName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appCommandLine: 'node dist/index.js'
      alwaysOn: true
      appSettings: [
        { name: 'NODE_ENV'; value: 'production' }
        { name: 'PORT'; value: '8080' }
        { name: 'DATABASE_URL'; value: databaseUrl }
        { name: 'JWT_SECRET'; value: jwtSecret }
        { name: 'JWT_REFRESH_SECRET'; value: jwtRefreshSecret }
        { name: 'ENCRYPTION_KEY'; value: encryptionKey }
        { name: 'CORS_ORIGIN'; value: 'https://${webAppName}.azurewebsites.net' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION'; value: '~20' }
      ]
    }
    httpsOnly: true
  }
}

// ---- App Service: Web ----
resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appCommandLine: 'npm start'
      alwaysOn: true
      appSettings: [
        { name: 'NODE_ENV'; value: 'production' }
        { name: 'NEXT_PUBLIC_API_URL'; value: 'https://${apiAppName}.azurewebsites.net' }
        { name: 'DATABASE_URL'; value: databaseUrl }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION'; value: '~20' }
      ]
    }
    httpsOnly: true
  }
}

// ---- Outputs ----
output apiUrl string = 'https://${apiApp.properties.defaultHostName}'
output webUrl string = 'https://${webApp.properties.defaultHostName}'
output dbServerFqdn string = postgresServer.properties.fullyQualifiedDomainName
output apiAppName string = apiApp.name
output webAppName string = webApp.name
