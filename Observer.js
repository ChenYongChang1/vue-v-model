class Watcher {
  constructor(vm, expr, cb){
    this.vm = vm;
    this.expr = expr;
    this.cb = cb;
    //先把旧值保存
    this.oldValue = this.getOldVal()
  }
  getOldVal(){
    Dep.target = this;
    const oldValue = compileUtil.getVal(this.expr, this.vm);
    Dep.target = null;
    return oldValue
  }
  update(){
    const newValue = compileUtil.getVal(this.expr, this.vm);
    if(newValue !== this.oldValue){
      this.cb(newValue)
    }
  }
}

class Dep{
  constructor(){
    this.subs = [];
  }
  //收集观察者
  addSub(watcher){
    this.subs.push(watcher);
  }
  //通知观察者去更新
  notify(){
    console.log('通知了观察者',this.subs);
    this.subs.forEach(w => w.update())
  }
}

class Observer {
  constructor(data) {
    this.observer(data)
  }
  observer(data) {
    if (data && typeof data === 'object') {
      // console.log(Object.keys(data));
      Object.keys(data).forEach(key => {
        this.defineReactive(data, key, data[key])
      })
    }
  }
  defineReactive(obj, key, value) {
    //递归遍历
    this.observer(value)
    const dep = new Dep()
    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: false,
      get() {
        //订阅数据变化时，往dep中添加观察者
        Dep.target && dep.addSub(Dep.target)
        return value
      },
      set: (newVal) => {
        this.observer(newVal)
        if (newVal !== value) {
          value = newVal;
          //告诉dep通知变化
          dep.notify()
        }
      }
    })
  }
}