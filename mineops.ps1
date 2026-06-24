$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $Root "apps/mineops-cli/src/index.js") @args
