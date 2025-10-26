# Quick Test Script for UCAS Portal
# Run this after starting the server with: npm start

Write-Host "`n=== UCAS Portal Quick Tests ===" -ForegroundColor Cyan
Write-Host "`nMake sure the server is running on http://localhost:3000`n"

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
    Write-Host "✓ Response: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Randomise new student
Write-Host "`nTest 2: Randomise new student (UCAS: 0123456789)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/randomise" `
        -Method POST `
        -ContentType "application/x-www-form-urlencoded" `
        -Body "ucas_code=0123456789" `
        -UseBasicParsing
    Write-Host "✓ Response: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Try same student again (should show already assigned)
Write-Host "`nTest 3: Re-submit same student (should show already assigned)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/randomise" `
        -Method POST `
        -ContentType "application/x-www-form-urlencoded" `
        -Body "ucas_code=0123456789" `
        -UseBasicParsing
    Write-Host "✓ Response: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Invalid UCAS code
Write-Host "`nTest 4: Invalid UCAS code (should fail)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/randomise" `
        -Method POST `
        -ContentType "application/x-www-form-urlencoded" `
        -Body "ucas_code=abc" `
        -UseBasicParsing
    Write-Host "✓ Response: $($response.Content)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "✓ Expected error: $responseBody" -ForegroundColor Green
    } else {
        Write-Host "✗ Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 5: JISC Webhook
Write-Host "`nTest 5: JISC Webhook (add student 9876543210)" -ForegroundColor Yellow
try {
    $body = @{
        ucas_code = "9876543210"
        email = "test@example.com"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/jisc-webhook" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{"x-webhook-secret" = "replace-with-a-long-secret"} `
        -Body $body `
        -UseBasicParsing
    Write-Host "✓ Response: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Admin search (requires auth)
Write-Host "`nTest 6: Admin search (with Basic Auth)" -ForegroundColor Yellow
try {
    $creds = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:change-this"))
    $response = Invoke-WebRequest -Uri "http://localhost:3000/admin/search" `
        -Headers @{Authorization = "Basic $creds"} `
        -UseBasicParsing
    Write-Host "✓ Response: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Tests Complete ===" -ForegroundColor Cyan
Write-Host "`nTo access the portal:" -ForegroundColor White
Write-Host "  Student Portal: http://localhost:3000" -ForegroundColor White
Write-Host "  Admin Dashboard: http://localhost:3000/admin (user: admin, pass: change-this)" -ForegroundColor White
Write-Host "`nFor detailed tests, see TESTING.md`n"
