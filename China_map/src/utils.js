// 角度转弧度
const angle2Radian = (angle) => {
    return angle * (Math.PI / 180);
}
// 弧度转角度
const radian2Angle = (radian) => {
    return radian * (180 / Math.PI);
}

// 地球半径
const EARTH_RAD = 6378137

// 地球周长
const EARTH_PERIMETER = 2 * Math.PI * EARTH_RAD

// 地理坐标转换为投影坐标
export const geo2Proj = (lng, lat) => {
    let x = angle2Radian(lng) * EARTH_RAD
    let rad = angle2Radian(lat)
    let sin = Math.sin(rad)
    let y = EARTH_RAD / 2 * Math.log((1+sin)/(1-sin))
    return [x, y]
}

// 投影坐标转换为地理坐标
export const proj2Geo = (x, y) => {
    let lng = radian2Angle(x) / EARTH_RAD
    let lat = radian2Angle((2 * Math.atan(Math.exp(y / EARTH_RAD)) - (Math.PI / 2)))
    return [lng, lat]
}

// 瓦片像素
export const TILE_SIZE = 256

// 获取某一层级下的分辨率
const getResolution = (n) => {
    const tileNum = Math.pow(2, n)
    const tileTotalPx = tileNum * TILE_SIZE
    return EARTH_PERIMETER/tileTotalPx
}

// 从1到18的分辨率列表
export const resolutions = []
for(let i = 0; i <= 18; i++){
    resolutions.push(getResolution(i))
    // console.log("resolution is " + resolutions[i]);
}

// 根据投影坐标及缩放层级计算行列号
export const getTileIndex = (zoom, x, y) => {
    // console.log("x is " + x + " y is " + y + " zoom is " + zoom);
    // 因为瓦片的原点在左上角，而投影坐标系原点在赤道和本初子午线交汇点，因而需要对x,y进行修改
    x += EARTH_PERIMETER / 2     
    y = EARTH_PERIMETER / 2 - y 
    let resolution = resolutions[zoom]
    let row = Math.floor(x / resolution / TILE_SIZE)
    let col = Math.floor(y / resolution / TILE_SIZE)
    return [row, col]
}

// 将平面坐标根据缩放等级转换为世界平面图的像素坐标
export const getPxFromProj = (x, y, zoom) => {
    // 转换为以经度0、纬度0为原点的坐标系
    x += EARTH_PERIMETER / 2
    y = EARTH_PERIMETER / 2 - y
    let xx = Math.floor(x / resolutions[zoom])
    let yy = Math.floor(y / resolutions[zoom])
    return [xx, yy]
}

// 将经纬度转化为像素坐标
export const getPxFromGeo = (lng, lat, zoom) => {
    let [x, y] = geo2Proj(lng, lat)
    return getPxFromProj(x, y, zoom)
}

// 根据瓦片序列号得到瓦片地址
export const getTileUrl = (x, y, zoom) => {
    let domainIndexList = [0, 1, 2, 3, 4, 5, 6, 7]
    let domainIndex =
      domainIndexList[Math.floor(Math.random() * domainIndexList.length)]
    return [
        `https://t${domainIndex}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX=${zoom}&TILEROW=${y}&TILECOL=${x}&tk=${tk}`,
        `http://t${domainIndex}.tianditu.com/DataServer?T=cva_w&tk=${tk}&x=${x}&y=${y}&l=${zoom}`
    ]
}

export const getAdministrativeUrl = (keyword) => {
    return `http://api.tianditu.gov.cn/v2/administrative?keyword=${keyword}&childLevel=1&extensions=false&tk=${tk}`
}

const tk = `fce73fa0a082ed9dc336050dcf24432d`