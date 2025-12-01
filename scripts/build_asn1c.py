import os
import subprocess
import sys
import shutil
import platform

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPTS_DIR)
ASN1C_SOURCE_DIR = os.path.join(ROOT_DIR, "sources", "asn1c", "repo")
ASN1C_BIN_DIR = os.path.join(ROOT_DIR, "sources", "asn1c", "bin")
ASN1C_EXECUTABLE = os.path.join(ASN1C_BIN_DIR, "asn1c.exe" if platform.system() == "Windows" else "asn1c")

def check_prerequisites():
    """Check if necessary build tools are available."""
    required_tools = ["make", "gcc"]
    # On Windows, we might rely on WSL or MinGW/MSYS types of environments.
    # For now, we'll check specifically for what's likely to be in PATH.
    # flex/bison are needed for autogen.
    
    if platform.system() != "Windows":
        required_tools.extend(["autoreconf", "libtool", "bison", "flex"])
    
    missing = []
    for tool in required_tools:
        if not shutil.which(tool):
            missing.append(tool)
    
    if missing:
        print(f"Error: Missing required build tools: {', '.join(missing)}")
        print("Please ensure you have a build environment (e.g. build-essential, autotools on Linux; MSYS2/MinGW on Windows).")
        return False
    return True

def build_asn1c():
    """Build asn1c from source."""
    print(f"Building asn1c in {ASN1C_SOURCE_DIR}...")
    
    if not os.path.exists(ASN1C_SOURCE_DIR):
        print(f"Error: Source directory {ASN1C_SOURCE_DIR} not found.")
        return False

    os.makedirs(ASN1C_BIN_DIR, exist_ok=True)

    # On Windows, we might need a different strategy if not using WSL/Cygwin/MSYS.
    # Assuming a Unix-like environment (Git Bash, WSL, or MSYS2) for the build steps is safest for asn1c 
    # as it uses autotools.
    
    # If strictly Windows cmd/powershell, building autotools projects is hard.
    # We will attempt to run the standard ./configure && make sequence.
    
    # Note: simple check if we are on pure Windows without sh
    if platform.system() == "Windows" and not shutil.which("sh"):
        print("Error: 'sh' not found. To build asn1c on Windows, you need a Unix-like environment (MSYS2, Git Bash, etc.) in your PATH.")
        return False

    cwd = os.getcwd()
    try:
        os.chdir(ASN1C_SOURCE_DIR)
        
        # Clean previous builds if any
        if os.path.exists("Makefile"):
             subprocess.run(["make", "clean"], shell=True)

        # 1. autoreconf (generate configure script)
        # Windows users might need to run this manually if tools are missing
        if not os.path.exists("configure"):
             print("Running autoreconf...")
             subprocess.check_call(["autoreconf", "-iv"], shell=True)

        # 2. configure
        print("Running configure...")
        subprocess.check_call(["sh", "./configure"], shell=True)

        # 3. make
        print("Running make...")
        subprocess.check_call(["make"], shell=True)

        # 4. Copy binary
        src_bin = os.path.join(ASN1C_SOURCE_DIR, "asn1c", "asn1c.exe" if platform.system() == "Windows" else "asn1c")
        if os.path.exists(src_bin):
            print(f"Copying compiled binary to {ASN1C_EXECUTABLE}...")
            shutil.copy2(src_bin, ASN1C_EXECUTABLE)
            print("Build successful!")
            return True
        else:
            print("Error: Compilation appeared to succeed but binary was not found.")
            return False

    except subprocess.CalledProcessError as e:
        print(f"Error during build step: {e}")
        return False
    finally:
        os.chdir(cwd)

if __name__ == "__main__":
    if check_prerequisites():
        if build_asn1c():
            sys.exit(0)
        else:
            sys.exit(1)
    else:
        sys.exit(1)








