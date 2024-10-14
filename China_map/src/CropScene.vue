<script>
export default {
    mounted() {
        this.receiveAndSendMessage();
    },
    methods: {
        receiveAndSendMessage(){
            let cropType = this.$route.query.cropType;
            let startDate = this.$route.query.startDate;
            let endDate = this.$route.query.endDate;
            let curDate = this.$route.query.curDate;
            let provName = this.$route.query.provName;
            let statName = this.$route.query.statName;
            let iframeDom = document.getElementById('child');
            console.log('statName is ' + statName);
            iframeDom.onload = function() {
                iframeDom.contentWindow.setMessage(cropType, startDate, endDate, curDate, provName, statName);
            }
        },
    }
}
</script>
<template>
    <div>
        <el-icon style="position: absolute; "><Back /></el-icon>
        <iframe id="child" ref="unityWindows" src="/digital_twin_for_crop_growth_webgl/index.html"></iframe>
    </div>
</template>

<style scoped>


#child {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none; 
}

</style>