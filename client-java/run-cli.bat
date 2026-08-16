@echo off
echo ==============================================
echo   FlareCall Java Calling Client (CLI Mode)
echo ==============================================
javac -d bin src/com/flarecall/*.java
if %ERRORLEVEL% NEQ 0 (
    echo Compilation failed.
    pause
    exit /b %ERRORLEVEL%
)
java -cp bin com.flarecall.FlareCallApp --cli
