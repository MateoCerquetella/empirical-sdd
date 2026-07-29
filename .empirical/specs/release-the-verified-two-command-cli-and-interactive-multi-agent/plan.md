# Plan: Publish Empirical 0.20.1

1. Update the package manifest, runtime product version, README current-release
   label, core assertion, and distribution smoke assertion to `0.20.1`.
2. Search all remaining `0.20.0` references and retain only historical text
   that intentionally describes the original version reset.
3. Run type checking, the full test suite, built CLI/MCP smoke, and package
   dry-run; inspect the packed file list and resolve any failure before release.
4. Review the version-only implementation diff and commit the complete release
   candidate, including its Empirical contract and evidence-ready artifacts.
5. Reconfirm npm identity, confirm `0.20.1` is absent, and publish once with
   public access.
6. Query npm until the exact version and `latest` tag both resolve to `0.20.1`.
7. Create a temporary consumer, install the exact registry version locally,
   verify version/help and package contents, then remove the fixture.
8. Record structured verification and review evidence, archive the package
   distribution capability, and report the npm installation command.
