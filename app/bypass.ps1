(Get-Content 'app\src\features\radar\RadarPage.tsx') -replace 'if \(cached\) \{', 'if (false) {' | Set-Content 'app\src\features\radar\RadarPage.tsx'
