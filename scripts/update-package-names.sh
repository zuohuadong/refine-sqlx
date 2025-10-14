#!/bin/bash

# Script to update package names from old to new scoped names
# Usage: ./scripts/update-package-names.sh

set -e

echo "🔄 Updating package names in documentation and source files..."

# Define replacements
# Note: Order matters - do more specific replacements first
declare -A replacements=(
  ["from 'refine-sql'"]="from '@refine-sqlx/sql'"
  ["from \"refine-sql\""]="from \"@refine-sqlx/sql\""
  ["import { createPostgreSQLProvider } from 'refine-orm'"]="import { createPostgreSQLProvider } from '@refine-sqlx/orm'"
  ["import { createPostgreSQLProvider } from \"refine-orm\""]="import { createPostgreSQLProvider } from \"@refine-sqlx/orm\""
  ["from 'refine-orm'"]="from '@refine-sqlx/orm'"
  ["from \"refine-orm\""]="from \"@refine-sqlx/orm\""
  ["from 'refine-core'"]="from '@refine-sqlx/core'"
  ["from \"refine-core\""]="from \"@refine-sqlx/core\""
  ["npm install refine-sql"]="npm install @refine-sqlx/sql"
  ["npm install refine-orm"]="npm install @refine-sqlx/orm"
  ["npm install refine-core"]="npm install @refine-sqlx/core"
  ["yarn add refine-sql"]="yarn add @refine-sqlx/sql"
  ["yarn add refine-orm"]="yarn add @refine-sqlx/orm"
  ["pnpm add refine-sql"]="pnpm add @refine-sqlx/sql"
  ["pnpm add refine-orm"]="pnpm add @refine-sqlx/orm"
  ["bun add refine-sql"]="bun add @refine-sqlx/sql"
  ["bun add refine-orm"]="bun add @refine-sqlx/orm"
  ["**refine-orm**"]="**@refine-sqlx/orm**"
  ["**refine-sql**"]="**@refine-sqlx/sql**"
  ["**refine-core**"]="**@refine-sqlx/core**"
  ["### 🚀 [refine-orm]"]="### 🚀 [@refine-sqlx/orm]"
  ["### ⚡ [refine-sql]"]="### ⚡ [@refine-sqlx/sql]"
  ["refine-sql (main)"]="@refine-sqlx/sql (main)"
  ["refine-orm (main)"]="@refine-sqlx/orm (main)"
)

# Find all markdown files
echo "📝 Processing markdown files..."
find . -name "*.md" -not -path "*/node_modules/*" -not -path "*/dist/*" -type f | while read -r file; do
  echo "  Processing: $file"
  # Create backup
  cp "$file" "$file.bak"

  # Apply replacements
  for old in "${!replacements[@]}"; do
    new="${replacements[$old]}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|$old|$new|g" "$file"
    else
      sed -i "s|$old|$new|g" "$file"
    fi
  done

  # Remove backup if file changed
  if diff "$file" "$file.bak" > /dev/null; then
    rm "$file.bak"
  else
    rm "$file.bak"
    echo "    ✓ Updated"
  fi
done

# Find all TypeScript example files
echo "📝 Processing TypeScript example files..."
find ./examples -name "*.ts" -type f | while read -r file; do
  echo "  Processing: $file"
  cp "$file" "$file.bak"

  for old in "${!replacements[@]}"; do
    new="${replacements[$old]}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|$old|$new|g" "$file"
    else
      sed -i "s|$old|$new|g" "$file"
    fi
  done

  if diff "$file" "$file.bak" > /dev/null; then
    rm "$file.bak"
  else
    rm "$file.bak"
    echo "    ✓ Updated"
  fi
done

echo "✅ Package names updated successfully!"
echo ""
echo "Summary of changes:"
echo "  refine-sql → @refine-sqlx/sql"
echo "  refine-orm → @refine-sqlx/orm"
echo "  refine-core → @refine-sqlx/core"
echo ""
echo "New packages are marked as private and won't be published to npm."
