Installation Notes - Windows

Missing Header
If compilation fails with Cannot open include file: 'postgres.h': No such file or directory, make sure PGROOT is correct.

```cmd
set PGROOT=C:\Program Files\PostgreSQL\16
```

Mismatched Architecture

If compilation fails with error C2196: case value '4' already used, make sure vcvars64.bat was called. Then run nmake /F Makefile.win clean and re-run the installation instructions.

Missing Symbol

If linking fails with unresolved external symbol float_to_shortest_decimal_bufn with Postgres 17.0-17.2, upgrade to Postgres 17.3+.

Permissions

If installation fails with Access is denied, re-run the installation instructions as an administrator.