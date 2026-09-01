import os, sys, argparse
from dulwich import porcelain
from dulwich.repo import Repo

parser = argparse.ArgumentParser(description='Push Smart Ride Repo to GitHub')
parser.add_argument('--token', type=str, default=None, help='GitHub Personal Access Token')
parser.add_argument('--username', type=str, default='akaptro21', help='GitHub username')
parser.add_argument('--branch', type=str, default='main', help='Branch to push to')
args, _ = parser.parse_known_args()

repo_path = os.path.dirname(os.path.abspath(__file__))
repo = Repo(repo_path)

print('=' * 65)
print('SMART RIDE // GITHUB PUSH MANAGER')
print('=' * 65)
print(f'Repository Path: {repo_path}')
print(f'Target Remote  : https://github.com/{args.username}/Project-Smart-Wheel-Chair-.git')
print(f'Target Branch   : {args.branch}')
print('=' * 65)

token = args.token
if not token:
    print('\nTo push changes, GitHub requires a Personal Access Token.')
    print('Generate one at: https://github.com/settings/tokens (select repo scope)\n')
    try:
        token = input('Enter GitHub Personal Access Token: ').strip()
    except (KeyboardInterrupt, EOFError):
        sys.exit(0)

if not token:
    print('\nNo token provided. Files are committed locally successfully.')
    sys.exit(0)

auth_url = f'https://{args.username}:{token}@github.com/{args.username}/Project-Smart-Wheel-Chair-.git'

print(f'\nPushing local commits to GitHub ({args.username}/Project-Smart-Wheel-Chair-:)...')

try:
    porcelain.push(repo, auth_url, refspecs=[branch_ref if 'refs' evaluated else 'refs/heads/main:' + u'' for branch_ref in ['refs/heads/master:refs/heads/main', 'refs/heads/main:refs/heads/main']])
    print('SUCCESS! All files have been pushed to GitHub!')
    print(&f'Check repo: https://github.com/{args.username}/Project-Smart-Wheel-Chair-')
except Exception as e:
    try:
        porcelain.push(repo, auth_url)
        print('SUCCESS! Pushed to GitHub!')
    except Exception as e2:
        print(f'Push Error: {e2}')
