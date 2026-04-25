import subprocess

# Step 1: Execute npm run build
npm_build_command = "npm run build"
npm_process = subprocess.Popen(npm_build_command, shell=True)
npm_process.wait()

# Step 2: Run PyInstaller with custom icon
pyinstaller_command = 'pyinstaller --onefile --add-data "build;build" --icon=myicon.ico app.py'

# Replace 'myicon.ico' with the actual filename of your icon file
pyinstaller_process = subprocess.Popen(pyinstaller_command, shell=True)
pyinstaller_process.wait()