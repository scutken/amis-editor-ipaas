import {schema2component} from './AMISRenderer';

export default schema2component(
  {
    type: 'dialog',
    title: '新增页面/目录',
    body: {
      type: 'form',
      controls: [
        {
          type: 'switch',
          label: '类型',
          name: 'isDirectory',
          option: '目录',
          value: false,
          description: '开启后将创建目录，关闭则创建页面'
        },
        {
          type: 'select',
          label: '父级目录',
          name: 'parentId',
          placeholder: '选择父级目录（留空为根目录）',
          source: '${directories}',
          clearable: true
        },
        {
          type: 'input-text',
          label: '${isDirectory ? "目录名" : "文件名"}',
          name: 'name',
          placeholder: '${isDirectory ? "输入目录名" : "输入文件名"}',
          required: true,
          validations: {
            matchRegexp: '/^[a-zA-Z0-9]+$/',
          },
          validationErrors: {
            matchRegexp: '只能包含大小写字母和数字'
          },
          validate(values: any, value: string) {
            if (!value) return '';
            // 计算完整路径
            const getFullPath = (parentId: string, name: string, isDir: boolean): string => {
              if (!parentId) {
                return isDir ? name : name + '.json';
              }
              const parent = values.pages.find((p: any) => p.path === parentId);
              if (!parent) return isDir ? name : name + '.json';
              
              const getParentPath = (pid: string): string => {
                if (!pid) return '';
                const p = values.pages.find((page: any) => page.path === pid);
                if (!p) return '';
                const pp = p.parentId ? getParentPath(p.parentId) : '';
                return pp + p.label + '/';
              };
              
              const parentPath = getParentPath(parentId);
              return isDir ? parentPath + name : parentPath + name + '.json';
            };
            
            const fullPath = getFullPath(values.parentId, value, values.isDirectory);
            const exists = !!values.pages.filter(
              (item: any) => item.path === fullPath
            ).length;
            return exists ? '当前名称已存在，请换一个名称' : '';
          }
        }
      ]
    }
  },
  ({onConfirm, pages, ...rest}: any) => {
    // 构建目录选项列表（只包含目录，不包含页面）
    const buildDirectoryOptions = (items: any[], level = 0): any[] => {
      let options: any[] = [];
      items.forEach((item: any) => {
        if (item.isDirectory) {
          const prefix = '　'.repeat(level); // 使用全角空格缩进
          options.push({
            label: prefix + item.label,
            value: item.path  // 使用 path 作为 value
          });
          if (item.children && item.children.length > 0) {
            options = options.concat(buildDirectoryOptions(item.children, level + 1));
          }
        }
      });
      return options;
    };

    // 获取目录的完整路径
    const getDirectoryPath = (parentPath: string, pages: any[]): string => {
      if (!parentPath) return '';
      const parent = pages.find((p: any) => p.path === parentPath);
      if (!parent) return '';
      const parentDirPath = parent.parentId ? getDirectoryPath(parent.parentId, pages) : '';
      return parentDirPath + parent.label + '/';
    };

    const directories = buildDirectoryOptions(pages);

    return {
      ...rest,
      data: {
        pages,
        directories
      },
      onConfirm: (values: Array<any>) => {
        const originalData = values[0];
        // 创建新对象，避免修改 frozen 对象
        const data: any = {
          label: originalData.name,  // 使用 name 作为 label
          isDirectory: originalData.isDirectory || false
        };
        
        if (originalData.parentId) {
          data.parentId = originalData.parentId;
        }
        
        // 构建完整路径
        if (originalData.name) {
          const dirPath = data.parentId ? getDirectoryPath(data.parentId, pages) : '';
          // 目录不加 .json 后缀，页面加 .json 后缀
          data.path = data.isDirectory ? dirPath + originalData.name : dirPath + originalData.name + '.json';
        }
        
        onConfirm && onConfirm(data);
      }
    };
  }
);
