<script>
import { animate } from "popmotion";
import { ref } from "vue";
import gcoord from 'gcoord';
import { useRouter } from "vue-router";
import {
  getTileUrl,
  TILE_SIZE,
  getPxFromProj,
  getPxFromGeo,
  geo2Proj,
  proj2Geo,
  resolutions,
  getTileIndex,
  getAdministrativeUrl
} from "./utils";
class Tile {
  constructor({ctx, x, y, row, col, zoom}) {
    // 画布上下文
    this.ctx = ctx;
    // 左上角像素点位置
    this.x = x;
    this.y = y;
    // 该瓦片的行列号
    this.row = row;
    this.col = col;
    // 该瓦片的缩放等级
    this.zoom = zoom; 
    // 图片是否已经加载
    this.loaded1 = false;
    // 注记是否已经加载
    this.loaded2 = false;

    // 创建url
    this.createUrl();
    // 加载图片
    this.load();
  };

  // 创建url
  createUrl() {
    this.url = getTileUrl(this.row, this.col, this.zoom);
  }

  // 根据url加载图片
  load() {
    this.img1 = new Image();
    this.img1.src = this.url[0];
    this.img1.onload = () => {
      this.loaded1 = true;
      this.render1();
    }
    this.img2 = new Image();
    this.img2.src = this.url[1];
    this.img2.onload = () => {
      this.loaded2 = true;
      this.render2();
    }
  }

  render1() {
    if(this.loaded1){
      this.ctx.drawImage(this.img1, this.x, this.y);
    }
  }

  render2() {
    if(this.loaded2){
      this.ctx.drawImage(this.img2, this.x, this.y);
    }
  }

  render(){
    this.render1();
    this.render2();
  }

  updatePos(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

}

class CacheItem {
  constructor({tile, timestamp}) {
    // 瓦片对象
    this.tile = tile;
    // 时间戳，用于给删除缓存的线程判断该缓存是否过时
    this.timestamp = timestamp;
    // 未来可能访问的层级（数值越接近5说明未来越可能访问，最小为0）
    this.level = 5;
  };

  clean() {
    this.timestamp = null;
    this.tile = null;
  }
}

export default {
  name: "App",
  setup(props, context){
    const value1 = ref('');
    const value2 = ref('');
    const size = ref('default');
    const disabledDate = (time) => {
      return time.getTime() > Date.now();
    }
    const router = useRouter();
    return {
      value1,
      value2,
      size,
      disabledDate,
      router,
    }
  },
  data() {
    return {
      // 画布宽高
      width: 0,
      height: 0,
      // 缓存相关
      tileCache: new Map(),
      currentCacheKeys: [],
      low_bound: 256,
      up_bound: 512,
      timestamp: null,
      // 初始中心经纬度
      centerGeo: [116.75, 36.783333],
      // 缩放等级
      zoom: 13,
      // 缩放层级范围
      minZoom: 3,
      maxZoom: 18,
      // 绘图上下文
      ctx: null,
      // 缩放相关
      targetScale: 1,
      currentScale: 1,
      playback:null,
      // 行政区划搜索相关
      selectProvOptions: [
      { value: '156110000', text: '北京市' },
      { value: '156120000', text: '天津市' },
      { value: '156130000', text: '河北省' },
      { value: '156140000', text: '山西省' },
      { value: '156150000', text: '内蒙古自治区' },
      { value: '156210000', text: '辽宁省' },
      { value: '156220000', text: '吉林省' },
      { value: '156230000', text: '黑龙江省' },
      { value: '156310000', text: '上海市' },
      { value: '156320000', text: '江苏省' },
      { value: '156330000', text: '浙江省' },
      { value: '156340000', text: '安徽省' },
      { value: '156350000', text: '福建省' },
      { value: '156360000', text: '江西省' },
      { value: '156370000', text: '山东省' },
      { value: '156410000', text: '河南省' },
      { value: '156420000', text: '湖北省' },
      { value: '156430000', text: '湖南省' },
      { value: '156440000', text: '广东省' },
      { value: '156450000', text: '广西壮族自治区' },
      { value: '156460000', text: '海南省' },
      { value: '156500000', text: '重庆市' },
      { value: '156510000', text: '四川省' },
      { value: '156520000', text: '贵州省' },
      { value: '156530000', text: '云南省' },
      { value: '156540000', text: '西藏自治区' },
      { value: '156610000', text: '陕西省' },
      { value: '156620000', text: '甘肃省' },
      { value: '156630000', text: '青海省' },
      { value: '156640000', text: '宁夏回族自治区' },
      { value: '156650000', text: '新疆维吾尔自治区' },
      { value: '156710000', text: '台湾省' },
      { value: '156810000', text: '香港特别行政区' },
      { value: '156820000', text: '澳门特别行政区' }
      ],
      selectedProvValue: '#',
      selectCityOptions: [],
      selectedCityValue: '#',
      selectCountyOptions: [],
      selectedCountyValue: '#',

      // 页面跳转相关
      btnClick: false,
      
    };
  },
  mounted() {
    this.initCanvas();
    this.renderTiles();
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("wheel", this.onMouseRoll);
    // 后台删除cache
    setInterval(()=> {
      if(this.tileCache.size <= this.low_bound) return;
      // console.log("between low and high");
      while(this.tileCache.size > this.low_bound &&
        this.tileCache.size < this.up_bound){
        this.tileCache.forEach((cacheItem, cacheKey, map) =>{
          if(cacheItem.timestamp < this.timestamp){
            if(cacheItem.level == 0){
              this.tileCache.delete(cacheKey);
              // console.log("1 delete item " + cacheKey);
            } else {
              cacheItem.level--;
            }
          }
        })
      }
      // 当大于up_bound时，除了现在访问的瓦片，其余直接删除，直到low_bound
      let count = this.tileCache.size - this.up_bound;
      if(count >= 0){
        // console.log("high");
        this.tileCache.forEach((cacheItem, cacheKey, map) => {
          this.tileCache.delete(cacheKey);
          // console.log("2 delete item " + cacheKey);
          if((--count) <= 0) return;
        })
      }
    }, 1000);
  },
  beforeUnmount() {
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("wheel", this.onMouseRoll);
  },
  methods: {
    // 初始化画布
    initCanvas(){
      // 获取容器宽高
      let {width, height} = this.$refs.map.getBoundingClientRect();
      this.width = width;
      this.height = height;
      // 设置画布宽高
      let canvas = this.$refs.canvas;
      canvas.width = this.width;
      canvas.height = this.height;
      this.ctx = canvas.getContext("2d");
      // 移动画布原点
      this.ctx.translate(this.width/2, this.height/2);
    },
    
    // 渲染瓦片
    renderTiles(){;
      // 从中心瓦片开始渲染
      // 首先需要将经纬度由火星坐标系改为4326
      let centerGeo4326 = gcoord.transform(
        [...this.centerGeo],
        gcoord.GCJ02,
        gcoord.WGS84
      );
      let centerTile = getTileIndex(
        this.zoom,
        ...geo2Proj(...centerGeo4326)
      );
      // 中心瓦片左上角的像素坐标
      let centerLHTilePos = [
        centerTile[0] * TILE_SIZE,
        centerTile[1] * TILE_SIZE
      ];
      // 中心瓦片中心点的像素坐标
      let centerCTilePos = getPxFromGeo(...centerGeo4326, this.zoom);
      // 两者的差值
      let diff = [
        centerCTilePos[0] - centerLHTilePos[0],
        centerCTilePos[1] - centerLHTilePos[1]
      ];
      // 计算上下左右各需要的瓦片数
      let rowMinNum = Math.ceil((this.width / 2 - diff[0]) / TILE_SIZE);
      let colMinNum = Math.ceil((this.height / 2 - diff[1]) / TILE_SIZE);
      let rowMaxNum = Math.ceil(
        (this.width / 2 - (TILE_SIZE - diff[0])) / TILE_SIZE
      );
      let colMaxNum = Math.ceil(
        (this.height / 2 - (TILE_SIZE - diff[1])) / TILE_SIZE
      );
      // 渲染画布内所有瓦片
      this.currentCacheKeys = [];
      this.timestamp = Date.now();
      let copiedtimestamp = new Date(this.timestamp);
      for(let i = -rowMinNum; i <= rowMaxNum; i++){
        for(let j = -colMinNum; j <= colMaxNum; j++){
          let row = centerTile[0] + i;
          let col = centerTile[1] + j;
          let x = i*TILE_SIZE - diff[0];
          let y = j*TILE_SIZE - diff[1];
          this.renderTile(row, col, x, y, copiedtimestamp);
        }
      }
    },
    // 清除画布
    clear() {
      this.ctx.clearRect(
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      );
    },
    // 渲染瓦片
    renderTile(row, col, x, y, timestamp){
      let cacheKey = row + '_' + col + '_' + this.zoom;
      // 如果有缓存
      if(this.tileCache.has(cacheKey)){
        // console.log("have cache");
        this.tileCache.get(cacheKey).level = 5;
        this.tileCache.get(cacheKey).timestamp = timestamp;
        this.tileCache.get(cacheKey).tile.updatePos(x, y).render();
      } else {
        let tile = new Tile({
          ctx: this.ctx,
          row,
          col,
          zoom: this.zoom,
          x,
          y
        });
        this.tileCache.set(
          cacheKey,
          new CacheItem({
            tile: tile, 
            timestamp: timestamp
          })
        );
      }
      this.currentCacheKeys.push(cacheKey);
    },

    // 鼠标松开
    onMouseUp(e) {
      this.isMousedown = false;
    },

    // 鼠标按下
    onMouseDown(e) {
      this.isMousedown = true;
    },

    // 鼠标移动
    onMouseMove(e) {
      if(!this.isMousedown){
        return;
      }
      // 计算本次拖动的距离对应的经纬度数据
      let deltax = e.movementX * resolutions[this.zoom];
      let deltay = e.movementY * resolutions[this.zoom];
      let centerGeo4326 = gcoord.transform(
        [...this.centerGeo],
        gcoord.GCJ02,
        gcoord.WGS84
      );
      let [x, y] = geo2Proj(...centerGeo4326);
      // 更新拖动后的中心点经纬度
      centerGeo4326 = proj2Geo(x - deltax, deltay + y);
      this.centerGeo = gcoord.transform(
        [...centerGeo4326],
        gcoord.WGS84,
        gcoord.GCJ02
      );
      // 清除画布重新渲染瓦片
      this.clear();
      this.renderTiles();
    },

    // 鼠标滚动
    onMouseRoll(e) {
      if(e.deltaY > 0 && this.zoom > this.minZoom) this.zoom--;
      if(e.deltaY < 0 && this.zoom < this.maxZoom) this.zoom++;
      // 更新缩放比例
      this.targetScale *= e.deltaY > 0 ? 0.5 : 2;
      // 停止上一次动画
      if(this.playback){
        this.playback.stop();
      }
      // 开启动画
      this.playback = animate({
        from: this.currentScale,
        to:this.targetScale,
        onUpdate: (latest) => {
          this.currentScale = latest;
          this.ctx.save();
          this.clear();
          this.ctx.scale(latest, latest);
          // 刷新当前画布上的瓦片
          for(let i = 0; i < this.currentCacheKeys.length; i++) {
            // console.log(this.tileCache.has(this.currentCacheKeys[i]));
            this.tileCache.get(this.currentCacheKeys[i]).tile.render();
          }
          this.ctx.restore();
        },
        onComplete: () => {
          // 完成动画后将缩放值重置为1
          this.targetScale = 1;
          this.currentScale = 1;
          // 根据最终缩放值重新计算需要的瓦片并渲染
          this.renderTiles();
        }
      });
    },
    
    // 行政区划搜索
    printSelectedResult(value) {
      console.log("value is " + value);
    },
    
    getAndSetSelecteOptions(provKey, selectOptions, zoom_t) {
      selectOptions.length = 0;
      // 如果是默认值，则直接返回
      if(provKey == '#') return;
      return fetch(getAdministrativeUrl(provKey))
        .then(response => {
            if(!response.ok){
                throw new Error("network error");
            }
            return response.json()
        })
        .then(json => {
          let data = json.data.district[0];
          this.centerGeo = [data.center.lng, data.center.lat];
          this.zoom = zoom_t;
          console.log(data.children[0]);
          // 重新渲染图片
          this.renderTiles();
          // 添加地级市州级下拉框添加选项
          for(let i = 0; i < data.children.length; i++){
            selectOptions.push({value: data.children[i].gb, text: data.children[i].name});
          }
        })
        .catch(err => console.log('Request Failed', err)); 
    },

    // 页面跳转相关
    jumpTo3DScene() {
      this.btnClick = true;
      this.router.push({
        path: '/crop',
        query: {
          cropType: 1,
          startDate: '2019-10-26',
          endDate: '2020-06-12',
          curDate: '2020-01-30',
          provName: '山东省',
          statName: '齐河县',
        }
      });
    }
  }
}

</script>

<template>
  <div class="map" ref="map">
    <canvas ref="canvas" @mousedown="onMouseDown"></canvas>
    <!-- 经纬度展示 -->
    <div class="leftup" style="font-size: 20px; color: white;">{{ "经度：" + this.centerGeo[0].toFixed(4) + ",\n" + "维度：" + this.centerGeo[1].toFixed(4) }}</div>
    <!-- 中心十字 -->
    <div class="line lineX"></div>
    <div class="line lineY"></div>
    <!-- 行政区划选择框 -->
    <div class="secondtitle" style="top: 50px; right: 20px;">地点预设系统</div>
    <div class="thirdtitle" style="top: 105px; right: 370px;">地点</div>
    <select class="selectBox" style="right: 260px; top: 100px;" v-model="selectedProvValue" @change="getAndSetSelecteOptions($event.target.value, selectCityOptions, 5)">
      <option value=#>省直辖市</option>
      <option v-for="opt in selectProvOptions" :key="opt.value" :value="opt.value">{{ opt.text }}</option>
    </select>
    <select class="selectBox" style="right: 140px; top: 100px;" v-model="selectedCityValue" @change="getAndSetSelecteOptions($event.target.value, selectCountyOptions, 8)">
      <option value=#>地级市州</option>
      <option v-for="opt in selectCityOptions" :key="opt.value" :value="opt.value">{{ opt.text }}</option>
    </select>    
    <select class="selectBox" style="right: 20px; top: 100px;" v-model="selectedCountyValue" @change="getAndSetSelecteOptions($event.target.value, [], 11)">
      <option value=#>区县旗</option>
      <option v-for="opt in selectCountyOptions" :key="opt.value" :value="opt.value">{{ opt.text }}</option>
    </select>
    <!-- 作物选择框 -->
    <div class="secondtitle" style="top: 150px; right: 20px;">作物预设系统</div>
    <div class="thirdtitle" style="top: 205px; right: 370px;">作物</div>
    <select class="selectBox" style="right:260px; top:200px">
      <option value="None" selected>None</option>
      <option value=1>小麦</option>
      <option value=2>玉米</option>
      <option value=3>水稻</option>
    </select>
    <div class="thirdtitle" style="top: 245px; right: 370px;">年份</div>
    <div class="thirdtitle" style="top: 285px; right: 370px;">日期</div>
    <div class="demo-date-picker" style="top: 250px; right:260px;">
      <div class="block">
        <el-date-picker
          v-model="value1"
          type="date"
          placeholder="Pick a day"
          :size="size"
        />
      </div>
    </div>
    <div 
      class="button" 
      :class="{ active: this.btnClick == true}"
      style="top: 330px; right: 150px;"
      @click="jumpTo3DScene()"
    >
      观察模式
    </div>
  </div>
</template>

<style scoped>
body, html {
  margin: 0;
  padding: 0;
  height: 100%;
}

.map {
  position: fixed;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
}

.line {
  position: absolute;
  background-color: #000;
}

.lineX {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 50px;
  height: 2px;
}

.lineY {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  height: 50px;
  width: 2px;
}

.center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translateX(-50%);
}

.leftup {
  position: absolute;
  top: 60px;
  left: 200px;
  transform: translateX(-50%);
}

.selectBox {
  position: absolute;
  width: 100px;
  height: 30px;
}

.secondtitle {
  display: flex;
  align-items: center;
  justify-content: center;
  width:400px;
  height: 40px;
  background-color: white;
  position: absolute;
  font-size: 20px; 
}

.thirdtitle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 20px;
  background-color: white;
  position: absolute;
  font-size: 10px; 
}

.demo-date-picker {
  position: absolute;
  display: flex;
  width: 100px;
  height: 20px;
  padding: 0;
  flex-wrap: wrap;
}

.demo-date-picker .block {
  padding: 30px 0;
  text-align: center;
  border-right: solid 1px var(--el-border-color);
  flex: 1;
}

.demo-date-picker .block:last-child {
  border-right: none;
}

.demo-date-picker .demonstration {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-bottom: 20px;
}

.button {
  position: fixed;
  display: flex;
  width: 150px;
  height: 30px;
  background-color: #fff;
  border-radius: 3px;
  overflow: hidden;
  line-height: 30px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
}
.button.active {
  background-color: #b3b3b3;
}
</style>
