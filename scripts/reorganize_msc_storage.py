#!/usr/bin/env python3
"""Script to reorganize MSC storage: move files to protocol subdirectories with readable names."""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.infrastructure.msc.msc_repository import MscRepository

def main():
    storage_path = os.path.join(os.path.dirname(__file__), '..', 'backend', 'msc_storage')
    storage_path = os.path.abspath(storage_path)
    
    print(f"Reorganizing MSC storage at: {storage_path}")
    
    repo = MscRepository(storage_path)
    result = repo.reorganize_storage()
    
    print(f"\nReorganization complete!")
    print(f"  - Files reorganized: {result['reorganized']}")
    print(f"  - Errors: {len(result['errors'])}")
    
    if result['errors']:
        print("\nErrors encountered:")
        for error in result['errors']:
            print(f"  - {error}")
    
    # Show new structure
    print("\nNew storage structure:")
    for item in sorted(os.listdir(storage_path)):
        item_path = os.path.join(storage_path, item)
        if os.path.isdir(item_path):
            file_count = len([f for f in os.listdir(item_path) if f.endswith('.json')])
            print(f"  {item}/ ({file_count} files)")
        elif item.endswith('.json'):
            print(f"  {item}")

if __name__ == '__main__':
    main()

