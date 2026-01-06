import React from 'react';
import {observer, inject} from 'mobx-react';
import {IMainStore} from '../store';
import {Button, AsideNav, Layout, confirm} from 'amis';
import {RouteComponentProps, matchPath, Switch, Route} from 'react-router';
import {Link} from 'react-router-dom';
import NotFound from './NotFound';
import AMISRenderer from '../component/AMISRenderer';
import AddPageModal from '../component/AddPageModal';
import JSZip from 'jszip';

function isActive(link: any, location: any) {
  const ret = matchPath(location?.pathname, {
    path: link ? link.replace(/\?.*$/, '') : '',
    exact: true,
    strict: true
  });

  return !!ret;
}

export default inject('store')(
  observer(function ({
    store,
    location,
    history
  }: {store: IMainStore} & RouteComponentProps) {
    function handleExportAll() {
      try {
        // 构建文件结构：每个页面导出为单独的 JSON 文件
        const files: {path: string; content: string}[] = [];
        
        store.pages.forEach((page: any) => {
          // 只导出页面，不导出目录
          if (!page.isDirectory && page.schema) {
            const filePath = `${page.path}.json`;
            const content = JSON.stringify(page.schema, null, 2);
            files.push({ path: filePath, content });
          }
        });
        
        if (files.length === 0) {
          store.notify('warning', '没有可导出的页面');
          return;
        }
        
        // 如果只有一个文件，直接下载
        if (files.length === 1) {
          const blob = new Blob([files[0].content], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = files[0].path;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          store.notify('success', '导出成功！');
          return;
        }
        
        // 多个文件，打包为 ZIP
        const zip = new JSZip();
        
        files.forEach(file => {
          zip.file(file.path, file.content);
        });
        
        // 生成 ZIP 文件
        zip.generateAsync({ type: 'blob' }).then(blob => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          link.download = `amis-pages-${timestamp}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          store.notify('success', `导出成功！共 ${files.length} 个文件。`);
        });
      } catch (error) {
        console.error('导出失败:', error);
        store.notify('error', '导出失败，请检查控制台');
      }
    }

    async function handleFetchConfig() {
      try {
        const response = await store.fetcher({
          url: '/ipaasadmin/superadmin/pages',
          method: 'get'
        });
        
        if (response.data && Array.isArray(response.data)) {
          confirm(`确认要使用后台配置覆盖当前数据吗？（共 ${response.data.length} 个项目）`).then(confirmed => {
            if (confirmed) {
              // 清空当前数据
              while (store.pages.length > 0) {
                store.removePageAt(0);
              }
              
              // 导入后台数据
              response.data.forEach((pageData: any) => {
                // 从 path 自动生成 label
                const pathParts = pageData.path.split('/');
                const fileName = pathParts[pathParts.length - 1];
                const label = fileName.replace('.json', '');
                
                store.addPage({
                  path: pageData.path,
                  label: label,  // 自动生成
                  schema: pageData.schema || {},
                  isDirectory: pageData.isDirectory || false,
                  parentId: pageData.parentId
                });
              });
              
              store.notify('success', `拉取成功！共 ${response.data.length} 个项目`);
              
              // 刷新页面
              setTimeout(() => {
                window.location.reload();
              }, 1000);
            }
          });
        } else {
          store.notify('error', '后台数据格式错误');
        }
      } catch (error) {
        console.error('拉取配置失败:', error);
        store.notify('error', '拉取配置失败，请检查后台服务');
      }
    }

    function renderHeader() {
      return (
        <>
          <div className={`cxd-Layout-brandBar`}>
            <div className="cxd-Layout-brand text-ellipsis">
              <i className="fas fa-paw"></i>
              <span className="hidden-folded m-l-sm">IPaaS AMIS 编辑器</span>
            </div>
          </div>
          <div className={`cxd-Layout-headerBar`}>
            <div className="hidden-xs p-t-sm ml-auto px-2">
              <Button 
                size="sm" 
                className="m-r-xs" 
                level="primary"
                onClick={handleFetchConfig}
              >
                拉取配置
              </Button>
              <Button 
                size="sm" 
                className="m-r-xs" 
                level="success"
                onClick={handleExportAll}
              >
                全部导出
              </Button>
              <Button
                size="sm"
                level="info"
                onClick={() => store.setAddPageIsOpen(true)}
              >
                新增页面
              </Button>
            </div>
          </div>
        </>
      );
    }

    function renderAside() {
      // 递归构建树状导航结构
      const buildTree = (pages: any[], parentId?: string): any[] => {
        return pages
          .filter(
            page => page.parentId === parentId || (!page.parentId && !parentId)
          )
          .map(page => {
            const children = buildTree(pages, page.path);  // 使用 path 作为 parentId
            return {
              label: page.label,  // 直接使用 label，不再关联 schema.title
              path: page.isDirectory ? undefined : `/${page.path}`, // 目录没有路径
              isDirectory: page.isDirectory,
              pageId: page.path,  // 使用 pageId 存储 path，避免与导航 path 冲突
              children: children.length > 0 ? children : undefined
            };
          });
      };

      const navigations = buildTree(store.pages.slice());
      const paths = store.pages.map((item: any) => `/${item.path}`);

      return (
        <AsideNav
          key={store.asideFolded ? 'folded-aside' : 'aside'}
          navigations={[
            {
              label: '导航',
              children: navigations
            }
          ]}
          renderLink={({link, toggleExpand, classnames: cx, depth}: any) => {
            if (link.hidden) {
              return null;
            }

            let children = [];

            if (link.children) {
              children.push(
                <span
                  key="expand-toggle"
                  className={cx('AsideNav-itemArrow')}
                  onClick={e => toggleExpand(link, e)}
                ></span>
              );
            }

            link.badge &&
              children.push(
                <b
                  key="badge"
                  className={cx(
                    `AsideNav-itemBadge`,
                    link.badgeClassName || 'bg-info'
                  )}
                >
                  {link.badge}
                </b>
              );

            // 显示图标：目录显示文件夹图标，文件显示文件图标
            children.push(
              <i 
                key="icon" 
                className={cx(
                  `AsideNav-itemIcon`,
                  link.isDirectory ? 'fas fa-folder' : 'fas fa-file'
                )} 
              />
            );

            // 只有非目录项才显示删除和编辑按钮
            if (!link.isDirectory) {
              link.active ||
                children.push(
                  <i
                    key="delete"
                    data-tooltip="删除"
                    data-position="bottom"
                    className={'navbtn fas fa-times'}
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      confirm('确认要删除').then(confirmed => {
                        confirmed && store.removePageAt(paths.indexOf(link.path));
                      });
                    }}
                  />
                );

              children.push(
                <i
                  key="edit"
                  data-tooltip="编辑"
                  data-position="bottom"
                  className={'navbtn fas fa-pencil'}
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    history.push(`/edit/${paths.indexOf(link.path)}`);
                  }}
                />
              );
            } else {
              // 目录显示删除按钮
              children.push(
                <i
                  key="delete"
                  data-tooltip="删除目录"
                  data-position="bottom"
                  className={'navbtn fas fa-times'}
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    confirm('确认要删除该目录？（所有子目录和页面也会被删除）').then(confirmed => {
                      if (confirmed) {
                        store.removePageById(link.pageId);
                      }
                    });
                  }}
                />
              );
            }

            children.push(
              <span key="label" className={cx('AsideNav-itemLabel')}>
                {link.label}
              </span>
            );

            return link.path ? (
              link.active ? (
                <a>{children}</a>
              ) : (
                <Link to={link.path[0] === '/' ? link.path : `${link.path}`}>
                  {children}
                </Link>
              )
            ) : (
              <a
                onClick={
                  link.onClick
                    ? link.onClick
                    : link.children
                    ? () => toggleExpand(link)
                    : undefined
                }
              >
                {children}
              </a>
            );
          }}
          isActive={(link: any) =>
            isActive(
              link.path && link.path[0] === '/' ? link.path : `${link.path}`,
              location
            )
          }
        />
      );
    }

    function handleConfirm(value: {
      label: string;
      icon?: string;
      path?: string;
      isDirectory?: boolean;
      parentId?: string;
    }) {
      // path 已经在 AddPageModal 中构建好了
      const pageData: any = {
        label: value.label,
        path: value.path,
        isDirectory: value.isDirectory || false
      };
      
      if (value.parentId) {
        pageData.parentId = value.parentId;
      }
      
      // 所有类型都需要 schema，目录使用空对象，页面使用默认模板
      pageData.schema = value.isDirectory
        ? {}
        : {
            type: 'page',
            title: '新页面',
            body: '这是你刚刚新增的页面。'
          };
      
      store.addPage(pageData);
      store.setAddPageIsOpen(false);
    }

    return (
      <Layout
        aside={renderAside()}
        header={renderHeader()}
        folded={store.asideFolded}
        offScreen={store.offScreen}
      >
        <Switch>
          {store.pages
            .filter((item: any) => !item.isDirectory) // 只渲染非目录的页面
            .map((item: any) => (
              <Route
                key={item.id}
                path={`/${item.path}`}
                render={() => <AMISRenderer schema={item.schema} />}
              />
            ))}
          <Route component={NotFound} />
        </Switch>
        <AddPageModal
          show={store.addPageIsOpen}
          onClose={() => store.setAddPageIsOpen(false)}
          onConfirm={handleConfirm}
          pages={store.pages.concat()}
        />
      </Layout>
    );
  })
);
