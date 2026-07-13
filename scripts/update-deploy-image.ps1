[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$ImageRef = "ghcr.io/mzakhar/vs-book-app:main",
  [string]$Digest,
  [string]$DeploymentPath,
  [switch]$Commit,
  [switch]$Push
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $DeploymentPath) {
  $DeploymentPath = Join-Path $repoRoot "k8s/base/deployment.yaml"
}
$resolvedDeploymentPath = (Resolve-Path -LiteralPath $DeploymentPath -ErrorAction SilentlyContinue).Path

function Resolve-ImageDigest {
  param([string]$Ref)

  $inspect = docker buildx imagetools inspect $Ref
  $match = $inspect | Select-String -Pattern '^Digest:\s+(sha256:[a-f0-9]+)' | Select-Object -First 1
  if (-not $match) {
    throw "Could not resolve digest for $Ref. Confirm the GHCR publish workflow has completed."
  }

  return $match.Matches[0].Groups[1].Value
}

if (-not (Test-Path -LiteralPath $DeploymentPath)) {
  throw "Deployment manifest not found: $DeploymentPath"
}
$resolvedDeploymentPath = (Resolve-Path -LiteralPath $DeploymentPath).Path
$resolvedRepoRoot = (Resolve-Path -LiteralPath $repoRoot).Path
$gitDeploymentPath = $resolvedDeploymentPath
if ($resolvedDeploymentPath.StartsWith($resolvedRepoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  $gitDeploymentPath = $resolvedDeploymentPath.Substring($resolvedRepoRoot.Length).TrimStart('\', '/')
}

if (-not $Digest) {
  $Digest = Resolve-ImageDigest -Ref $ImageRef
}

if ($Digest -notmatch '^sha256:[a-f0-9]{64}$') {
  throw "Invalid digest: $Digest"
}

$imageName = ($ImageRef -replace '[@:].*$', '')
$pinnedImage = "$imageName@$Digest"
$content = Get-Content -Raw -LiteralPath $DeploymentPath
$imagePattern = [regex]::Escape($imageName)
$updated = $content -replace "image:\s+$imagePattern(?:[:@][^\s]+)?", "image: $pinnedImage"

if ($updated -eq $content) {
  throw "No vs-book-app image line updated in $DeploymentPath"
}

if ($PSCmdlet.ShouldProcess($DeploymentPath, "Pin image to $pinnedImage")) {
  Set-Content -LiteralPath $DeploymentPath -Value $updated -NoNewline -Encoding utf8
}

Write-Host "Pinned deployment image:"
Write-Host "  $pinnedImage"

if ($Commit) {
  if ($PSCmdlet.ShouldProcess("git", "Commit deployment image update")) {
    git -C $repoRoot add -- $gitDeploymentPath
    git -C $repoRoot commit -m "Deploy vs-book-app image $Digest"
  }
}

if ($Push) {
  if (-not $Commit) {
    throw "-Push requires -Commit so the manifest update is included in Git."
  }
  if ($PSCmdlet.ShouldProcess("git", "Push deployment image update")) {
    git -C $repoRoot push
  }
}
