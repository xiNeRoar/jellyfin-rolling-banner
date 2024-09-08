#!/bin/bash

read -p "请输入 Jellyfin 容器名称:" name
echo "程序安装中...（如长时间未响应或下载失败，请检查网络是否能连接Github）"

# 在容器内创建文件夹
docker exec -it  $name rm -rf /jellyfin/jellyfin-web/jellyfin-rolling-banner/
docker exec -it  $name mkdir -p /jellyfin/jellyfin-web/jellyfin-rolling-banner/

# 下载所需文件到系统
echo "正在下载缓存文件，请稍等... ..."
wget -q --no-check-certificate https://raw.githubusercontent.com/xiNeRoar/jellyfin-rolling-banner/master/static/css/style.css -O style.css || { echo "错误：无法下载"; exit 1; }
wget -q --no-check-certificate https://raw.githubusercontent.com/xiNeRoar/jellyfin-rolling-banner/master/static/js/common-utils.js -O common-utils.js || { echo "错误：无法下载"; exit 1; }
wget -q --no-check-certificate https://raw.githubusercontent.com/xiNeRoar/jellyfin-rolling-banner/master/static/js/jquery-3.6.0.min.js -O jquery-3.6.0.min.js || { echo "错误：无法下载"; exit 1; }
wget -q --no-check-certificate https://raw.githubusercontent.com/xiNeRoar/jellyfin-rolling-banner/master/static/js/md5.min.js -O md5.min.js || { echo "错误：无法下载"; exit 1; }
wget -q --no-check-certificate https://raw.githubusercontent.com/xiNeRoar/jellyfin-rolling-banner/master/content/main.js -O main.js || { echo "错误：无法下载"; exit 1; }

# 从系统复制文件到容器内
docker cp style.css $name:/jellyfin/jellyfin-web/jellyfin-rolling-banner/
docker cp common-utils.js $name:/jellyfin/jellyfin-web/jellyfin-rolling-banner/
docker cp jquery-3.6.0.min.js $name:/jellyfin/jellyfin-web/jellyfin-rolling-banner/
docker cp md5.min.js $name:/jellyfin/jellyfin-web/jellyfin-rolling-banner/
docker cp main.js $name:/jellyfin/jellyfin-web/jellyfin-rolling-banner/

# 定义安装程序
function Installing() {
	# 读取index.html文件内容
	content=$(cat index.html)

	# 定义要插入的代码
	code='<link rel="stylesheet" id="theme-css" href="./jellyfin-rolling-banner/style.css" type="text/css" media="all" />\n<script src="./jellyfin-rolling-banner/common-utils.js"></script>\n<script src="./jellyfin-rolling-banner/jquery-3.6.0.min.js"></script>\n<script src="./jellyfin-rolling-banner/md5.min.js"></script>\n<script src="./jellyfin-rolling-banner/main.js"></script>'

	# 在</head>之前插入代码
	new_content=$(echo -e "${content/<\/head>/$code<\/head>}")

	# 将新内容写入index.html文件
	echo -e "$new_content" > index.html
	# 覆盖容器内取index.html文件
	docker cp ./index.html $name:/jellyfin/jellyfin-web/
}

# 先复制一份到系统内
docker cp $name:/jellyfin/jellyfin-web/index.html ./

# 检查index.html是否包含jellyfin-rolling-banner
if grep -q "jellyfin-rolling-banner" index.html; then
    docker cp $name:/jellyfin/jellyfin-web/bak/index.html ./
    Installing
    echo "成功！Index.html 已重新修改！"
else
    docker cp $name:/jellyfin/jellyfin-web/index.html ./
    # 备份
    docker exec -it  $name mkdir -p /jellyfin/jellyfin-web/bak/
    docker cp ./index.html $name:/jellyfin/jellyfin-web/bak/
    Installing
    echo "成功！Index.html 首次安装！"
fi
