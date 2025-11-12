#!/usr/bin/env python3
"""
文本文件查找替换工具
用于批量查找和替换Python文件中的导入语句
"""

import os
import re
import argparse
from typing import List, Tuple


def find_files_with_pattern(root_dir: str, pattern: str, file_ext: str = '.py') -> List[str]:
    """
    在指定目录中查找包含特定模式的文件
    
    Args:
        root_dir: 根目录路径
        pattern: 要查找的正则表达式模式
        file_ext: 文件扩展名，默认为.py
        
    Returns:
        包含匹配模式的文件路径列表
    """
    matching_files = []
    
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(file_ext):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        if re.search(pattern, content):
                            matching_files.append(file_path)
                except Exception as e:
                    print(f"读取文件 {file_path} 时出错: {e}")
    
    return matching_files


def replace_in_file(file_path: str, old_pattern: str, new_pattern: str, dry_run: bool = False) -> Tuple[bool, int]:
    """
    在单个文件中执行查找替换操作
    
    Args:
        file_path: 文件路径
        old_pattern: 要替换的模式
        new_pattern: 替换后的模式
        dry_run: 是否仅模拟运行，不实际修改文件
        
    Returns:
        (是否成功, 替换次数)
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 使用正则表达式进行替换
        new_content, count = re.subn(old_pattern, new_pattern, content)
        
        if count > 0:
            if not dry_run:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
            print(f"{'[模拟] ' if dry_run else ''}文件: {file_path}")
            print(f"  匹配模式: {old_pattern}")
            print(f"  替换为: {new_pattern}")
            print(f"  替换次数: {count}")
            print(f"  {'已修改' if not dry_run else '将修改'}")
            print("-" * 50)
            
        return True, count
        
    except Exception as e:
        print(f"处理文件 {file_path} 时出错: {e}")
        return False, 0


def main():
    parser = argparse.ArgumentParser(description='批量查找替换Python文件中的导入语句')
    parser.add_argument('root_dir', help='根目录路径')
    parser.add_argument('old_pattern', help='要查找的模式（正则表达式）')
    parser.add_argument('new_pattern', help='替换后的模式')
    parser.add_argument('--file-ext', default='.py', help='文件扩展名，默认为.py')
    parser.add_argument('--dry-run', action='store_true', help='仅模拟运行，不实际修改文件')
    parser.add_argument('--verbose', action='store_true', help='显示详细信息')
    
    args = parser.parse_args()
    
    print(f"开始查找替换操作:")
    print(f"根目录: {args.root_dir}")
    print(f"查找模式: {args.old_pattern}")
    print(f"替换模式: {args.new_pattern}")
    print(f"文件类型: *{args.file_ext}")
    print(f"模拟运行: {'是' if args.dry_run else '否'}")
    print("=" * 60)
    
    # 查找包含模式的文件
    matching_files = find_files_with_pattern(args.root_dir, args.old_pattern, args.file_ext)
    
    if not matching_files:
        print("未找到匹配的文件")
        return
    
    print(f"找到 {len(matching_files)} 个匹配的文件:")
    for file_path in matching_files:
        print(f"  - {file_path}")
    print("=" * 60)
    
    # 执行替换操作
    total_replacements = 0
    successful_files = 0
    
    for file_path in matching_files:
        success, count = replace_in_file(file_path, args.old_pattern, args.new_pattern, args.dry_run)
        if success:
            successful_files += 1
            total_replacements += count
    
    print("=" * 60)
    print(f"操作完成:")
    print(f"成功处理文件: {successful_files}/{len(matching_files)}")
    print(f"总替换次数: {total_replacements}")
    print(f"模拟运行: {'是' if args.dry_run else '否'}")


if __name__ == "__main__":
    main()