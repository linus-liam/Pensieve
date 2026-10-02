#!/bin/zsh
cd -- "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null; then
  print '未找到 Node.js。请先按 README 安装项目依赖。'
  read -k 1 '?按任意键关闭…'
  exit 1
fi
node scripts/start-local.mjs
if [[ $? -ne 0 ]]; then read -k 1 '?按任意键关闭…'; exit 1; fi
