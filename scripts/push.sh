#!/usr/bin/env bash
#
# 共通ソース（src/）を取引先ごとの GAS プロジェクトへ反映する。
#
#   ./scripts/push.sh tz     … clients/tz へ反映
#   ./scripts/push.sh all    … clients/ 配下すべてへ反映
#   ./scripts/push.sh        … 取引先の一覧を表示
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENTS_DIR="${REPO_ROOT}/clients"

list_clients() {
  find "${CLIENTS_DIR}" -mindepth 2 -maxdepth 2 -name '.clasp.json' -printf '%h\n' | xargs -r -n1 basename | sort
}

push_client() {
  local client="$1"
  local project="${CLIENTS_DIR}/${client}/.clasp.json"

  if [[ ! -f "${project}" ]]; then
    echo "エラー: 取引先「${client}」が見つかりません（${project}）" >&2
    echo "利用可能な取引先: $(list_clients | tr '\n' ' ')" >&2
    return 1
  fi

  echo "==> ${client} へ反映します"
  clasp push -f -P "${project}"
}

main() {
  if [[ $# -eq 0 ]]; then
    echo "利用可能な取引先:"
    list_clients | sed 's/^/  - /'
    echo
    echo "使い方: $0 {取引先名|all}"
    return 0
  fi

  if [[ "$1" == "all" ]]; then
    local client
    while read -r client; do
      push_client "${client}"
    done < <(list_clients)
    return 0
  fi

  push_client "$1"
}

main "$@"
