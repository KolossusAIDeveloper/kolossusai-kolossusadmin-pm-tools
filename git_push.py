import os
import subprocess

token = os.environ.get("GITHUB_TOKEN", "")
repo_path = "/app/data/sandboxes/2bdc59b1-615a-4f55-811f-3cb539325748/pm-tools"
remote_url = f"https://{token}@github.com/kolossusai/kolossusai-kolossusadmin-pm-tools.git"

def run(cmd, **kwargs):
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=repo_path, **kwargs)
    if result.returncode != 0:
        print(f"ERROR running {cmd}: {result.stderr}")
    else:
        print(f"OK: {' '.join(cmd)}: {result.stdout.strip()}")
    return result

# Set remote URL with token
run(["git", "remote", "set-url", "origin", remote_url])

# Checkout main branch
run(["git", "checkout", "-B", "main"])

# Stage all files
run(["git", "add", "-A"])

# Commit
result = run(["git", "commit", "-m", "feat: build pm-tools React app with proxy, board, tasks, comments"])
if "nothing to commit" in result.stdout:
    print("Nothing new to commit, pushing existing...")

# Push
push = run(["git", "push", "-u", "origin", "main", "--force"])
print("Push done:", push.returncode)
