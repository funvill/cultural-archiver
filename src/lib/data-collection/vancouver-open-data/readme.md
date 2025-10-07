Importing the artist file

```ps1
npx tsx src/lib/mass-import-system/cli/cli-entry.ts import --importer artist-json --exporter api --input src\lib\data-collection\vancouver-open-data\artists.json --config src\lib\mass-import-system\config\api-config-dev.json --generate-report --verbose --limit 1 --offset 0
```

