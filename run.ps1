# 按环境启动后端：.\run.ps1 dev | prod
# 读取 .env.<profile> 注入环境变量，并以 SPRING_PROFILES_ACTIVE=<profile> 启动 mvn spring-boot:run
param(
    [Parameter(Position = 0)]
    [string]$Profile = "dev"
)

$ErrorActionPreference = "Stop"
$envFile = ".env.$Profile"
if (-not (Test-Path $envFile)) {
    Write-Error "错误：找不到环境文件 $envFile"
    exit 1
}

Get-Content $envFile | ForEach-Object {
    $raw = $_.Split('#')[0].Trim()
    if ($raw -match '^export\s+') { $raw = $raw.Substring(7).Trim() }
    if ($raw -match '^([^=]+)=(.*)$') {
        $name = $Matches[1].Trim()
        $value = $Matches[2].Trim()
        # 去引号
        if (($value.Length -ge 2) -and ($value[0] -eq '"' -or $value[0] -eq "'") -and ($value[-1] -eq $value[0])) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

$env:SPRING_PROFILES_ACTIVE = $Profile
Write-Host "▶ 以 profile=$Profile 启动后端（已加载 $envFile）"
Set-Location backend
mvn spring-boot:run
