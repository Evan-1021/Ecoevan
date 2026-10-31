#!/bin/sh
# 改完 default-workspace/evan-personal-site.html 后，跑这个脚本即可同步并推送到 GitHub
# 用法：./sync.sh [源文件] [提交说明]
set -e
REPO="$HOME/Documents/deepseek-harness/evan-site"
SRC="${1:-$HOME/Documents/deepseek-harness/default-workspace/evan-personal-site.html}"
MSG="${2:-update site}"

cd "$REPO"
[ -f "$SRC" ] || { echo "找不到源文件：$SRC"; exit 1; }

cp "$SRC" index.html
cp "$SRC" evan-personal-site.html
git add -A

if git diff --cached --quiet; then
  echo "没有改动，跳过提交与推送"
  exit 0
fi

git commit -q -m "$MSG"
git push -q
printf '已推送 %s -> %s\n' "$(git rev-parse --short HEAD)" "$(git remote get-url origin)"
