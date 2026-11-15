#!/bin/zsh
# Saves a brand's Instagram token in the Mac keychain, without showing it and with no length limit.
#   zsh production/tools/save-token.sh example
# (security add-generic-password -w with no value cuts what you paste at 128 characters; a Meta token is longer.)
brand=${1:?Usage: save-token.sh <brand>}
print -n "Paste the token for $brand (it is not shown) and press Enter: "
read -rs token
print
token=${token//[[:space:]]/}
if [[ $token != EA* || ${#token} -lt 100 ]]; then
  print "That does not look like a Meta token (it should start with EA and be long). Nothing was saved."
  exit 1
fi
security add-generic-password -U -s "$brand-instagram" -a token -w "$token" && print "Saved in the keychain (${#token} characters)."
unset token
