# Script para agregar Node.js al PATH de la sesión actual
$nodeFolder = "c:\Users\tfws.olanet\Desktop\azmol-stockerp\node-v24.13.0-win-x64"
$env:PATH = "$nodeFolder;$nodeFolder\bin;$env:PATH"

Write-Host "✅ Node.js agregado al PATH" -ForegroundColor Green
Write-Host "Node: $(node --version)" -ForegroundColor Cyan
Write-Host "NPM: $(& $nodeFolder\npm.cmd --version)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ahora puedes ejecutar comandos npm:" -ForegroundColor Yellow
Write-Host "  npm run build" -ForegroundColor White
Write-Host "  npm test" -ForegroundColor White
Write-Host "  npx tsc --noEmit" -ForegroundColor White
