#requires -Version 5.1
param([string]$InputPath, [string]$OutputDirectory, [switch]$NoOpen)
$ErrorActionPreference = "Stop"

function ConvertTo-HtmlSafe {
    param($Value)
    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return "-" }
    return [System.Net.WebUtility]::HtmlEncode([string]$Value)
}

function Get-ReportValue {
    param($Object, [string]$PropertyName, $Fallback = "-")
    if ($null -eq $Object) { return $Fallback }
    $property = $Object.PSObject.Properties[$PropertyName]
    if ($null -eq $property) { return $Fallback }
    $value = $property.Value
    if ($null -eq $value -or [string]::IsNullOrWhiteSpace([string]$value)) { return $Fallback }
    return $value
}

function Get-AddressHtml {
    param($Address, [switch]$Billing)

    if ($null -eq $Address) { return "<p class='muted'>Brak danych.</p>" }

    $company = ConvertTo-HtmlSafe (Get-ReportValue $Address "company")
    $street = ConvertTo-HtmlSafe (Get-ReportValue $Address "street")
    $number = ConvertTo-HtmlSafe (Get-ReportValue $Address "streetNumber")
    $postcode = ConvertTo-HtmlSafe (Get-ReportValue $Address "postcode")
    $city = ConvertTo-HtmlSafe (Get-ReportValue $Address "city")

    if ($Billing) {
        $extra = "<div><b>NIP:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $Address 'nip'))</div>"
    } else {
        $extra = "<div><b>Telefon:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $Address 'phoneNumber'))</div>"
    }

    return "<div><div><b>Firma:</b> $company</div><div><b>Adres:</b> $street $number</div><div><b>Miasto:</b> $postcode $city</div>$extra</div>"
}

try {
    Write-Host ""
    Write-Host "Odczytuję finalTestReport ze schowka..." -ForegroundColor Cyan

    $raw = if ($InputPath) { Get-Content -Raw -LiteralPath $InputPath -Encoding UTF8 } else { Get-Clipboard -Raw }
    if ([string]::IsNullOrWhiteSpace($raw)) {
        throw "Schowek jest pusty. Skopiuj finalTestReport z Postmana."
    }

    $raw = $raw.Trim()

    if ($raw.StartsWith('"') -and $raw.EndsWith('"')) {
        try {
            $decoded = $raw | ConvertFrom-Json
            if ($decoded -is [string]) { $raw = $decoded }
        } catch {}
    }

    $marker = "FINAL_TEST_REPORT="
    $markerIndex = $raw.IndexOf($marker)

    if ($markerIndex -ge 0) {
        $raw = $raw.Substring($markerIndex + $marker.Length).Trim()
        $lastBrace = $raw.LastIndexOf("}")
        if ($lastBrace -ge 0) {
            $raw = $raw.Substring(0, $lastBrace + 1)
        }
    }

    try {
        $report = $raw | ConvertFrom-Json
    } catch {
        throw "Nie udało się odczytać JSON-a. Skopiuj samą wartość finalTestReport albo linię FINAL_TEST_REPORT={...}."
    }

    $reportDirectory = if ($OutputDirectory) { $OutputDirectory } else { Join-Path $PSScriptRoot "raporty" }
    if (-not (Test-Path $reportDirectory)) {
        New-Item -ItemType Directory -Path $reportDirectory | Out-Null
    }

    $orderId = Get-ReportValue $report.order "orderId" "brak-id"
    $safeOrderId = ([string]$orderId) -replace '[^\w\-]', '_'
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

    if ($report.generatedAt) {
        try {
            $timestamp = ([DateTimeOffset]::Parse([string]$report.generatedAt)).ToLocalTime().ToString("yyyy-MM-dd_HH-mm-ss")
        } catch {}
    }

    $baseName = "HURTOWNIA_${safeOrderId}_${timestamp}"
    $jsonPath = Join-Path $reportDirectory "$baseName.json"
    $htmlPath = Join-Path $reportDirectory "$baseName.html"

    $report | ConvertTo-Json -Depth 60 | Set-Content -Path $jsonPath -Encoding UTF8

    # Mapy produktów: dane początkowe, plan edycji i końcowe podsumowanie.
    $initialByCode = @{}
    foreach ($planned in @($report.initialProducts)) {
        if ($null -eq $planned) { continue }
        $code = [string]$planned.code
        if (-not $code -and $planned.isbn) {
            $isbn = ([string]$planned.isbn) -replace '[\s-]', ''
            $matches = @($report.summary.products | Where-Object { (([string]$_.isbn) -replace '[\s-]', '') -eq $isbn })
            if ($matches.Count -eq 1) { $code = [string]$matches[0].code }
        }
        if ($code) {
            if (-not $initialByCode.ContainsKey($code)) { $initialByCode[$code] = [pscustomobject]@{ quantity = 0 } }
            $initialByCode[$code].quantity += [decimal]$planned.quantity
        }
    }

    $editByCode = @{}
    foreach ($product in @($report.editedProducts)) {
        if ($product -and $product.productCode) { $editByCode[[string]$product.productCode] = $product }
    }

    $summaryByCode = @{}
    foreach ($product in @($report.summary.products)) {
        if ($product -and $product.code) { $summaryByCode[[string]$product.code] = $product }
    }

    $codes = New-Object System.Collections.Generic.List[string]
    foreach ($code in $initialByCode.Keys) { if (-not $codes.Contains($code)) { $codes.Add($code) } }
    foreach ($code in $editByCode.Keys) { if (-not $codes.Contains($code)) { $codes.Add($code) } }
    foreach ($code in $summaryByCode.Keys) { if (-not $codes.Contains($code)) { $codes.Add($code) } }

    $productRows = ""

    foreach ($code in $codes) {
        $initial = $initialByCode[$code]
        $edited = $editByCode[$code]
        $product = $summaryByCode[$code]

        $name = Get-ReportValue $product "name" (Get-ReportValue $edited "productName" "-")
        $initialQuantity = Get-ReportValue $initial "quantity" (Get-ReportValue $edited "oldQuantity" "-")
        $editedQuantity = Get-ReportValue $edited "newQuantity" "-"
        $finalQuantity = Get-ReportValue $product "quantity" $editedQuantity

        $productRows += @"
<tr>
<td><strong>$(ConvertTo-HtmlSafe $code)</strong></td>
<td>$(ConvertTo-HtmlSafe $name)</td>
<td class="num">$(ConvertTo-HtmlSafe $initialQuantity)</td>
<td class="num">$(ConvertTo-HtmlSafe $editedQuantity)</td>
<td class="num">$(ConvertTo-HtmlSafe $finalQuantity)</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "originalUnitPrice"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "unitPrice"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "rebatePercent"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "roundedRebatePercent"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "effectiveDiscountPercent"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "unitDiscount"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "discountedUnitPrice"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "grossBeforeDiscount"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "calculatedDiscountTotal"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "calculatedTotalFromDiscountedUnitPrice"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "total"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "totalDifference"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "discountedUnitPriceNet"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "totalNetSalesAfterDiscount"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "taxRate"))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product "taxValue"))</td>
</tr>
"@
    }

    if ([string]::IsNullOrWhiteSpace($productRows)) {
        $productRows = "<tr><td colspan='21' class='muted'>Brak danych produktów w finalTestReport.</td></tr>"
    }

    $success = $false
    if ($report.finalization -and $null -ne $report.finalization.success) {
        $success = [System.Convert]::ToBoolean($report.finalization.success)
    }

    if ($success) {
        $statusClass = "success"
        $statusText = "FINALIZACJA OK"
    } else {
        $statusClass = "failure"
        $statusText = "FINALIZACJA NIEUDANA"
    }

    # Wynik finalizacji nie jest wynikiem całego przebiegu.
    $testStatusHtml = '<div class="card"><h2>Wynik testów</h2><p>Brak zbiorczego wyniku w starszym raporcie.</p></div>'
    if ($null -ne $report.tests) {
        $testLabel = if ($report.tests.success) { 'TESTY OK' } else { 'TESTY NIEUDANE' }
        if (-not $report.tests.success) { $statusClass = 'failure' }
        $failedRows = ''
        foreach ($assertion in $report.tests.assertions) {
            if (-not $assertion.passed) {
                $failedRows += "<tr><td>$(ConvertTo-HtmlSafe $assertion.step)</td><td>$(ConvertTo-HtmlSafe $assertion.name)</td><td>$(ConvertTo-HtmlSafe $assertion.message)</td></tr>"
            }
        }
        $failuresHtml = if ($failedRows) { "<div class='table-wrap'><table><thead><tr><th>Krok</th><th>Test</th><th>Błąd</th></tr></thead><tbody>$failedRows</tbody></table></div>" } else { '' }
        $testStatusHtml = "<div class='card'><h2>$testLabel</h2><p>Wszystkie: $(ConvertTo-HtmlSafe $report.tests.total) | Poprawne: $(ConvertTo-HtmlSafe $report.tests.passed) | Błędne: $(ConvertTo-HtmlSafe $report.tests.failed)</p><p>Ziarno losowania: $(ConvertTo-HtmlSafe $report.run.seed)</p><p class='muted'>$(ConvertTo-HtmlSafe $report.tests.scope)</p>$failuresHtml</div>"
    }


    # Surowy rebatePercent: 1 = 1%, 0 = 0%. Brak danych nie jest zerem.
    function Format-StageValue {
        param($Value, [string]$Kind, [string]$Currency)
        if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return 'Brak danych' }
        $number = 0.0
        if (-not [double]::TryParse([string]$Value, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$number)) { return 'Nieprawidłowa wartość' }
        if ([double]::IsNaN($number) -or [double]::IsInfinity($number)) { return 'Nieprawidłowa wartość' }
        $culture = [System.Globalization.CultureInfo]::GetCultureInfo('pl-PL')
        if ($Kind -eq 'money') { return ConvertTo-HtmlSafe (($number / 100).ToString('N2', $culture) + ' ' + $Currency) }
        if ($Kind -eq 'percent') { return ($number.ToString('0.########', $culture) + '%') }
        if ($Kind -eq 'pp') { return ($number.ToString('0.########', $culture) + ' p.p.') }
        return $number.ToString('0.########', $culture)
    }
    $comparison = $report.productDiscountComparison
    $stageRows = ''
    foreach ($row in @($comparison.products)) {
        if ($null -eq $row) { continue }
        $before = $row.atPayment
        $after = $row.atSummary
        $beforeCurrency = [string]$comparison.atPayment.currency
        $afterCurrency = [string]$comparison.atSummary.currency
        $stageRows += @"
<tr>
<td><strong>$(ConvertTo-HtmlSafe $row.code)</strong><br>$(ConvertTo-HtmlSafe $row.name)<br>ISBN: $(ConvertTo-HtmlSafe $row.isbn)<br>Pozycja: $(ConvertTo-HtmlSafe $row.itemId)</td>
<td>$(Format-StageValue $before.quantity 'quantity') / $(Format-StageValue $after.quantity 'quantity')</td>
<td>$(Format-StageValue $before.rebatePercent 'percent')</td>
<td>$(Format-StageValue $after.rebatePercent 'percent')</td>
<td>$(Format-StageValue $row.rebateDifferencePp 'pp')</td>
<td>$(Format-StageValue $before.roundedRebatePercent 'percent') / $(Format-StageValue $after.roundedRebatePercent 'percent')</td>
<td>$(Format-StageValue $before.originalUnitPrice 'money' $beforeCurrency) / $(Format-StageValue $after.originalUnitPrice 'money' $afterCurrency)</td>
<td>$(Format-StageValue $before.discountedUnitPrice 'money' $beforeCurrency)</td>
<td>$(Format-StageValue $after.discountedUnitPrice 'money' $afterCurrency)</td>
<td>$(Format-StageValue $row.unitPriceDifference 'money' $afterCurrency)</td>
<td>$(Format-StageValue $before.total 'money' $beforeCurrency)</td>
<td>$(Format-StageValue $after.total 'money' $afterCurrency)</td>
<td>$(Format-StageValue $row.totalDifference 'money' $afterCurrency)</td>
<td>$(ConvertTo-HtmlSafe $row.status)$(if ($row.quantityChanged) { '<br>Uwaga: zmieniła się ilość.' })</td>
</tr>
"@
    }
    if (-not $stageRows) { $stageRows = '<tr><td colspan="14">Brak odczytów rabatów — uruchom pełną nową kolekcję.</td></tr>' }
    $offer = $comparison.paymentOffer
    $discountStagesHtml = @"
<div class="card">
<h2>Rabaty produktów: po wyborze płatności i na podsumowaniu</h2>
<p><b>Oferta płatności:</b> $(ConvertTo-HtmlSafe $offer.name) ($(ConvertTo-HtmlSafe $offer.code)). <b>Rabat metody:</b> $(Format-StageValue $offer.rebatePercent 'percent'). <b>orderItemTotal:</b> $(Format-StageValue $offer.orderItemTotal 'money' $comparison.atPayment.currency).</p>
<p class="muted">Oferta płatności jest informacją dla metody, nie rabatem przypisanym każdemu produktowi. API nie określa tutaj podstawy netto/brutto orderItemTotal.</p>
<p><b>Po wyborze płatności:</b> $(ConvertTo-HtmlSafe $comparison.atPayment.capturedAt), GET 7a.<br><b>Podsumowanie:</b> $(ConvertTo-HtmlSafe $comparison.atSummary.capturedAt), GET 10 przed zatwierdzeniem.</p>
<div style="overflow-x:auto"><table style="min-width:1600px"><thead><tr>
<th>Produkt</th><th>Ilość: płatność / podsumowanie</th><th>Rabat po wyborze płatności</th><th>Rabat na podsumowaniu</th><th>Zmiana rabatu</th><th>Rabat zaokr.: płatność / podsumowanie</th><th>Cena brutto/szt. przed rabatem: płatność / podsumowanie</th><th>Cena brutto/szt. po rabacie — płatność</th><th>Cena brutto/szt. po rabacie — podsumowanie</th><th>Zmiana ceny/szt.</th><th>Wartość brutto pozycji — płatność</th><th>Wartość brutto pozycji — podsumowanie</th><th>Zmiana wartości pozycji</th><th>Kompletność</th>
</tr></thead><tbody>$stageRows</tbody></table></div>
<p class="muted">Różnica = podsumowanie minus odczyt po wyborze płatności. Rabat pokazujemy z rebatePercent, bez przeliczania 1 na 100%. Sama zmiana nie oznacza błędu — między odczytami wybrano dostawę i adresy. Brakujące odczyty nie są zastępowane zerami.</p>
</div>
"@

    $shippingAddressHtml = Get-AddressHtml $report.checkout.shippingAddress
    $billingAddressHtml = Get-AddressHtml $report.checkout.billingAddress -Billing

    $shipping = $report.shipping
    if ($null -eq $shipping) { $shipping = $report.summary.shipping }
    $packageCount = Get-ReportValue $shipping "shipmentPackageQuantity" "Brak danych"
    $packageBefore = Get-ReportValue $shipping "shipmentPackageQuantityBefore" $packageCount
    $packageAfter = Get-ReportValue $shipping "shipmentPackageQuantityAfter" "Brak danych"
    $packageDifference = Get-ReportValue $shipping "packageQuantityDifference" "Brak porównania"
    $packageAfterNote = Get-ReportValue $shipping.packageQuantityAfter "note" ""
    $packageChangeHtml = ""
    if ($shipping.packageQuantityChanged -eq $true) {
        $packageChangeHtml = '<p class="warning"><b>Liczba paczek zmieniła się po zatwierdzeniu zamówienia.</b> Obie wartości pochodzą z osobnych odczytów API.</p>'
    }
    $shippingCost = Get-ReportValue $shipping "shippingTotal" (Get-ReportValue $report.summary "shippingTotal" "Brak danych")
    $weightUnit = Get-ReportValue $shipping "weightUnit" "Jednostka API — niepotwierdzona"
    $totalWeight = Get-ReportValue $shipping "totalProductsWeight" "Brak kompletu wag"
    $knownWeight = Get-ReportValue $shipping "knownProductsWeight" "Brak danych"
    $weightProducts = @($shipping.products | Where-Object { $null -ne $_ })
    if ($weightProducts.Count -eq 0) { $weightProducts = @($report.summary.products | Where-Object { $null -ne $_ }) }
    $weightRows = ""
    foreach ($product in $weightProducts) {
        $weightRows += @"
<tr>
<td>$(ConvertTo-HtmlSafe (Get-ReportValue $product 'code'))</td>
<td>$(ConvertTo-HtmlSafe (Get-ReportValue $product 'isbn'))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product 'quantity'))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product 'unitWeight' 'Brak danych'))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product 'totalWeight' 'Brak danych'))</td>
</tr>
"@
    }
    if (-not $weightRows) { $weightRows = '<tr><td colspan="5">Brak danych produktów.</td></tr>' }
    $weightNotice = ""
    if ($null -eq $shipping -or $shipping.weightDataComplete -ne $true) {
        $weightNotice = '<p class="warning">Brakuje kompletu wag produktów. Suma znanych wag nie jest pełną wagą zamówienia. Brak danych nie oznacza wagi zero.</p>'
    }
    if ($packageCount -eq 'Brak danych') {
        $weightNotice += '<p class="muted">Brak shipmentPackageQuantity w raporcie. Skopiuj nowy FINAL_TEST_REPORT po wykonaniu poprawionych kroków 10 i 11; jeśli pole nadal jest puste, sprawdź odpowiedź API.</p>'
    }

    $discountRows = ""
    foreach ($product in @($report.summary.products)) {
        if ($null -eq $product) { continue }
        $discountRows += @"
<tr>
<td><strong>$(ConvertTo-HtmlSafe (Get-ReportValue $product 'code'))</strong></td>
<td>$(ConvertTo-HtmlSafe (Get-ReportValue $product 'name'))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product 'quantity'))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product 'rebatePercent' 'Brak danych'))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product 'originalUnitPrice' 'Brak danych'))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product 'discountedUnitPrice' 'Brak danych'))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product 'unitDiscount' 'Brak danych'))</td>
<td class="num">$(ConvertTo-HtmlSafe (Get-ReportValue $product 'calculatedDiscountTotal' 'Brak danych'))</td>
</tr>
"@
    }
    if (-not $discountRows) { $discountRows = '<tr><td colspan="8">Brak danych produktów i rabatów.</td></tr>' }

    $html = @"
<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HURTOWNIA - raport zamówienia $(ConvertTo-HtmlSafe $orderId)</title>
<style>
body{font-family:"Segoe UI",Arial,sans-serif;background:#f5f6f8;color:#202124;margin:0;padding:28px}
.container{max-width:1500px;margin:0 auto}
h1{margin:0 0 8px}.subtitle,.muted{color:#6b7280}
.card{background:#fff;border:1px solid #e2e5e9;border-radius:10px;padding:20px;margin:16px 0;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.status{padding:18px 22px;border-radius:10px;color:#fff;font-weight:700;margin:20px 0}
.success{background:#16794b}.failure{background:#b42318}
.table-wrap{overflow-x:auto}
table{width:100%;min-width:1900px;border-collapse:collapse;background:#fff}
th,td{padding:10px;border-bottom:1px solid #e8eaed;text-align:left;vertical-align:top}
th{background:#f8f9fb;font-size:12px;position:sticky;top:0}
.num{text-align:right;white-space:nowrap}
.total{font-size:24px;font-weight:700;margin-top:12px}
.state{display:inline-block;background:#eef1f5;border-radius:6px;padding:5px 9px;margin:3px}
.warning{background:#fff7ed;border:1px solid #fed7aa;padding:12px;border-radius:8px}
.shipping-table{min-width:620px}.shipping-metrics{display:flex;gap:28px;flex-wrap:wrap;margin:16px 0}.shipping-metrics strong{display:block;font-size:24px;margin-top:6px}
</style>
</head>
<body>
<div class="container">

<h1>HURTOWNIA - raport testu koszyka</h1>
<div class="subtitle">Raport obejmuje dane produktów, edycję quantity, rabaty, netto/VAT, dostawę i finalizację.</div>

<div class="status $statusClass">
$statusText | HTTP $(ConvertTo-HtmlSafe (Get-ReportValue $report.finalization "statusCode"))
</div>

$testStatusHtml

<div class="grid">
<div class="card">
<h2>Zamówienie</h2>
<div><b>ID:</b> $(ConvertTo-HtmlSafe $orderId)</div>
<div><b>tokenValue:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.order "tokenValue"))</div>
<div><b>generatedAt:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report "generatedAt"))</div>
</div>

<div class="card">
<h2>Płatność i dostawa</h2>
<div><b>Płatność:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "paymentMethod"))</div>
<div><b>Dostawa:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "shippingMethod" (Get-ReportValue $report.checkout "shippingMethodCode")))</div>
</div>

<div class="card">
<h2>Stany</h2>
<span class="state">checkout: $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "checkoutState"))</span>
<span class="state">payment: $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "paymentState"))</span>
<span class="state">shipping: $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "shippingState"))</span>
</div>
</div>

<div class="card">
<h2>Paczki, waga i koszt wysyłki</h2>
<div class="shipping-metrics">
<div>Paczki przed zapisaniem<strong>$(ConvertTo-HtmlSafe $packageBefore)</strong></div>
<div>Paczki po zapisaniu<strong>$(ConvertTo-HtmlSafe $packageAfter)</strong></div>
<div>Różnica (po − przed)<strong>$(ConvertTo-HtmlSafe $packageDifference)</strong></div>
<div>Całkowity koszt wysyłki<strong>$(ConvertTo-HtmlSafe $shippingCost)</strong></div>
<div>Łączna waga produktów<strong>$(ConvertTo-HtmlSafe $totalWeight)</strong></div>
</div>
<p class="muted">Jednostka wagi: $(ConvertTo-HtmlSafe $weightUnit). Waga pozycji = waga jednej sztuki × końcowa liczba sztuk. Waga produktów nie obejmuje opakowań.</p>
$weightNotice
$packageChangeHtml
<p class="muted">shipmentPackageQuantity: przed = GET podsumowania (krok 10), po = odpowiedź zatwierdzenia (krok 11). $(ConvertTo-HtmlSafe $packageAfterNote)</p>
<p><b>Wybrana metoda dostawy:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.checkout 'shippingMethodCode' 'Brak danych'))</p>
<div class="table-wrap"><table class="shipping-table">
<thead><tr><th>Kod produktu</th><th>ISBN</th><th class="num">Liczba sztuk</th><th class="num">Waga / szt.</th><th class="num">Waga × sztuki</th></tr></thead>
<tbody>$weightRows</tbody></table></div>
<p><b>Suma znanych wag:</b> $(ConvertTo-HtmlSafe $knownWeight)</p>
<p class="muted">Źródło: $(ConvertTo-HtmlSafe (Get-ReportValue $shipping 'source' 'Brak danych')).</p>
</div>

$discountStagesHtml

<div class="card">
<h2>Rabaty przydzielone produktom</h2>
<div class="table-wrap"><table style="min-width:1000px" class="discount-table">
<thead><tr>
<th>Kod</th><th>Produkt</th><th class="num">Liczba sztuk</th>
<th class="num">Rabat API</th><th class="num">Cena oryginalna / szt.</th>
<th class="num">Cena po rabacie / szt.</th><th class="num">Rabat / szt.</th>
<th class="num">Rabat × sztuki</th>
</tr></thead>
<tbody>$discountRows</tbody>
</table></div>
<p class="muted">Rabat API to rebatePercent zwrócony przez API. Rabat kwotowy = cena oryginalna − cena po rabacie; rabat łącznie uwzględnia końcową liczbę sztuk. Zaokrąglenia mogą powodować różnice względem naliczeń API.</p>
<p class="muted">Promocja/rabat całego zamówienia pozostaje osobno w podsumowaniu i nie jest ponownie doliczany do tej tabeli.</p>
</div>

<div class="card">
<h2>Produkty i rabaty — szczegóły</h2>
<div class="table-wrap">
<table>
<thead>
<tr>
<th>Kod</th>
<th>Produkt</th>
<th class="num">Ilość początkowa</th>
<th class="num">Po edycji</th>
<th class="num">Końcowa</th>
<th class="num">Cena oryginalna</th>
<th class="num">Cena jednostkowa API</th>
<th class="num">Rabat API</th>
<th class="num">Rabat zaokr.</th>
<th class="num">Rabat efektywny</th>
<th class="num">Zniżka / szt.</th>
<th class="num">Cena po rabacie</th>
<th class="num">Przed rabatem</th>
<th class="num">Rabat łącznie</th>
<th class="num">Wyliczone po rabacie</th>
<th class="num">API total</th>
<th class="num">Różnica</th>
<th class="num">Netto / szt.</th>
<th class="num">Netto łącznie</th>
<th class="num">VAT</th>
<th class="num">Podatek</th>
</tr>
</thead>
<tbody>
$productRows
</tbody>
</table>
</div>
<p class="muted">„Różnica” = API total - (cena po rabacie × ilość). Wartość różna od 0 może wskazywać na dodatkową precyzję/zaokrąglenia lub dodatkowe korekty backendu.</p>
</div>

<div class="grid">
<div class="card"><h2>Adres wysyłki</h2>$shippingAddressHtml</div>
<div class="card"><h2>Adres rozliczeniowy</h2>$billingAddressHtml</div>
</div>

<div class="grid">
<div class="card">
<h2>Podsumowanie zamówienia</h2>
<div><b>Różnych produktów:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "differentProducts"))</div>
<div><b>Łączna liczba sztuk:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "totalQuantity"))</div>
<hr>
<div><b>Produkty:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "itemsTotal"))</div>
<div><b>Promocja/rabat zamówienia:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "orderPromotionTotal"))</div>
<div><b>Dostawa:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "shippingTotal"))</div>
<div><b>Dostawa netto:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "shippingTotalNet"))</div>
<div><b>VAT dostawy:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "shippingTaxRate"))</div>
<div><b>Netto zamówienia:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "totalNet"))</div>
<div><b>Podatek API:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "taxTotal"))</div>
<div class="total">RAZEM: $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "orderTotal"))</div>
</div>

<div class="card">
<h2>Kontrola sum</h2>
<div><b>Suma item.total:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "calculatedItemsTotal"))</div>
<div><b>itemsTotal API:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "itemsTotal"))</div>
<div><b>Różnica itemsTotal:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "itemsTotalDifference"))</div>
<div><b>Produkty + dostawa:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "calculatedOrderTotalWithoutPromotion"))</div>
<div><b>Różnica do total API:</b> $(ConvertTo-HtmlSafe (Get-ReportValue $report.summary "orderTotalDifference"))</div>
</div>
</div>

</div>
</body>
</html>
"@

    Set-Content -Path $htmlPath -Value $html -Encoding UTF8

    Write-Host ""
    Write-Host "Gotowe." -ForegroundColor Green
    Write-Host "HTML: $htmlPath"
    Write-Host "JSON: $jsonPath"
    Write-Host ""

    if (-not $NoOpen) {
        $chromePath = @(
            'C:\Program Files\Google\Chrome\Application\chrome.exe',
            'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
        ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        try {
            if ($chromePath) {
                $reportUri = ([Uri]$htmlPath).AbsoluteUri
                Start-Process -FilePath $chromePath -ArgumentList @('--new-window', $reportUri) -WindowStyle Normal
            } else {
                Write-Warning 'Raport zapisany. Nie znaleziono Chrome — otwórz HTML ręcznie.'
            }
        } catch {
            Write-Warning "Raport zapisany, ale nie udało się otworzyć przeglądarki: $($_.Exception.Message)"
        }
    }
}
catch {
    Write-Host ""
    Write-Host "BŁĄD: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    if (-not $NoOpen) { Read-Host "Naciśnij Enter, aby zakończyć" }
    exit 1
}
