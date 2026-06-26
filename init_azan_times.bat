@echo off
if exist .git ( rmdir /s /q .git )
"C:\Program Files\Git\cmd\git.exe" init
"C:\Program Files\Git\cmd\git.exe" config user.name "onestorefoundations-wq"
"C:\Program Files\Git\cmd\git.exe" config user.email "onstrorefoundations@gmail.com"
"C:\Program Files\Git\cmd\git.exe" add .
"C:\Program Files\Git\cmd\git.exe" commit -m "Initial commit"
"C:\Program Files\Git\cmd\git.exe" branch -M main
gh repo create azan-times --public --source=. --remote=origin --push
pause
