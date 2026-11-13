$ErrorActionPreference='Stop'
$assetFolder=Join-Path $PSScriptRoot 'assets/explore'
New-Item -ItemType Directory -Force -Path $assetFolder | Out-Null
$items=@(
 @{key='dadaocheng';title='Dadaocheng Wharf container market 2022.jpg'},
 @{key='calligraphy';title='Calligraphy Greenway with Park Lane by CMP.jpg'},
 @{key='pier2';title='Dusk at Pier 2 001.jpg'},
 @{key='qixingtan';title='QIXINGTAN beach taiwan.jpg'}
)
$credits=@()
foreach($item in $items){
 $title=[uri]::EscapeDataString('File:'+$item.title)
 $uri='https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=960&titles='+$title
 $result=Invoke-RestMethod -Uri $uri -Headers @{'User-Agent'='RoamTaiwanPrototype/1.0 (photo attribution review)'}
 $page=$result.query.pages.PSObject.Properties.Value | Select-Object -First 1
 $info=$page.imageinfo[0]
 if(!$info.thumburl){throw ('No thumbnail: '+$item.title)}
 Invoke-WebRequest -Uri $info.thumburl -OutFile (Join-Path $assetFolder ($item.key+'.jpg'))
 $credits+=@{key=$item.key;title=$item.title;file='/assets/explore/'+$item.key+'.jpg';source=$info.descriptionurl;author=$info.extmetadata.Artist.value;license=$info.extmetadata.LicenseShortName.value;licenseUrl=$info.extmetadata.LicenseUrl.value;description=$info.extmetadata.ImageDescription.value}
 Write-Output ($item.key+' | '+$info.extmetadata.LicenseShortName.value+' | '+$info.descriptionurl)
}
$credits | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $assetFolder 'credits.json')
$search=Invoke-RestMethod -Uri 'https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srsearch=%E8%A7%80%E5%A4%95%E5%B9%B3%E5%8F%B0&srlimit=5'
$search.query.search | Select-Object title | ConvertTo-Json
