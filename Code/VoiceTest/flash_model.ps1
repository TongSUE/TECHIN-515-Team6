# ============================================================
# flash_model.ps1 — 烧录 ESP-SR 模型数据到 XIAO ESP32-S3
# 只需运行一次。之后每次上传 VoiceTest 草图不需要重新烧录模型。
# ============================================================
#
# 使用方法：
#   1. 在 Arduino IDE 中确认你的 COM 端口（工具 → 端口）
#   2. 修改下面 $PORT 变量为你的端口号，例如 "COM5"
#   3. 右键本文件 → "用 PowerShell 运行"
# ============================================================

$PORT     = "COM3"    # ← 改成你的实际 COM 端口

$ESPTOOL  = "F:\Arduino_data\packages\esp32\tools\esptool_py\5.2.0\esptool.exe"
$MODEL    = "F:\Arduino_data\packages\esp32\tools\esp32s3-libs\3.3.8\esp_sr\srmodels.bin"
$OFFSET   = "0x3C0000"   # model 分区起始地址（与 partitions.csv 一致）

Write-Host "========================================"
Write-Host " ESP-SR 模型烧录脚本"
Write-Host "========================================"
Write-Host "端口   : $PORT"
Write-Host "模型   : $MODEL"
Write-Host "偏移量 : $OFFSET"
Write-Host "大小   : $([math]::Round((Get-Item $MODEL).Length / 1MB, 2)) MB"
Write-Host ""

if (-not (Test-Path $ESPTOOL)) {
    Write-Host "ERROR: esptool 不存在: $ESPTOOL" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}
if (-not (Test-Path $MODEL)) {
    Write-Host "ERROR: 模型文件不存在: $MODEL" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

Write-Host "正在烧录，请稍候（约 30 秒）..."
& $ESPTOOL --chip esp32s3 --port $PORT --baud 460800 write_flash $OFFSET $MODEL

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ 模型烧录成功！" -ForegroundColor Green
    Write-Host "现在可以正常上传并运行 VoiceTest.ino"
} else {
    Write-Host ""
    Write-Host "❌ 烧录失败，请检查：" -ForegroundColor Red
    Write-Host "  1. COM 端口是否正确"
    Write-Host "  2. 设备是否已连接"
    Write-Host "  3. Arduino IDE 是否已关闭串口监视器"
}

Read-Host "`n按回车退出"