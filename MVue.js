const compileUtil = {
  getVal(expr, vm) {
    const dataVm = typeof vm.$data === 'function' ? vm.$data() : vm.$data
    return expr.split('.').reduce((data, currentVal) => {
      return data[currentVal]
    }, dataVm)
  },
  setVal(expr, vm, inputVal){
    const dataVm = typeof vm.$data === 'function' ? vm.$data() : vm.$data
    return expr.split('.').reduce((data, currentVal) => {
      data[currentVal] = inputVal
    }, dataVm)

  },
  getContentVal(expr, vm){
    return expr.replace(/\{\{(.*?)\}\}/g, (...args)=> {
      return this.getVal(args[1], vm)
    })
  },
  text(node, expr, vm) { //expr: msg
    let value;
    if(expr.indexOf('{{') !== -1){
      //处理双大括号
      value = expr.replace(/\{\{(.*?)\}\}/g, (...args)=> {
        new Watcher(vm, args[1], ()=>{
          this.updater.textUpdater(node, this.getContentVal(expr, vm))
        })
        return this.getVal(args[1], vm)
      })
      // console.log(value);
    }else{
      value = this.getVal(expr, vm); //vm.$data()[expr];
      new Watcher(vm, expr, (newVal)=>{
        this.updater.textUpdater(node, newVal)
      })
    }
    
    this.updater.textUpdater(node, value)
  },
  html(node, expr, vm) {
    const value = this.getVal(expr, vm); //vm.$data()[expr];
    new Watcher(vm, expr, (newVal)=>{
      this.updater.htmlUpdater(node, newVal)
    })
    this.updater.htmlUpdater(node, value)
  },
  model(node, expr, vm) {
    const value = this.getVal(expr, vm); //vm.$data()[expr];
    //数据驱动试图
    new Watcher(vm, expr, (newVal)=>{
      this.updater.modelUpdater(node, newVal)
    })
    //试图 =》 数据 =》 视图
    node.addEventListener('input', (e)=>{
      this.setVal(expr, vm, e.target.value)
    })
    this.updater.modelUpdater(node, value)
  },
  on(node, expr, vm, eventName) { 
    let fn = vm.$options.methods && vm.$options.methods[expr]
    node.addEventListener(eventName,fn.bind(vm), false)
  },
  updater: {
    textUpdater(node, value) {
      node.textContent = value
    },
    htmlUpdater(node, value) {
      node.innerHTML = value
    },
    modelUpdater(node, value) {
      node.value = value
    },
  }
}

class Compile {
  constructor(el, vm) {
    this.el = this.isElementNode(el) ? el : document.querySelector(el);
    this.vm = vm;
    // 1. 获取文档碎片对象 放入内存 会减少页面的回流重绘
    const fragment = this.node2Fragment(this.el);
    // console.log(fragment);
    //2 编译模板

    this.compile(fragment);

    //3. 追加子元素到根元素
    this.el.appendChild(fragment)
  }
  node2Fragment(el) {
    //创建文档碎片
    const f = document.createDocumentFragment();
    let firstChild;
    while (firstChild = el.firstChild) {
      f.appendChild(firstChild);
    }
    return f;
  }
  isElementNode(node) {
    return node.nodeType === 1;
  }
  compile(fragment) {
    //1. 获取子节点 
    const childNodes = fragment.childNodes;
    [...childNodes].forEach(child => {
      // console.log(child);
      if (this.isElementNode(child)) {
        // 是元素节点
        // 编译元素节点
        // console.log('元素节点',child);
        this.compileElement(child)
      } else {
        // 文本节点
        //编译文本节点
        // console.log('文本节点',child);
        this.compileText(child)
      }
      if (child.childNodes && child.childNodes.length) {
        this.compile(child)
      }
    })
  }
  isDirective(attrName) {
    return attrName.startsWith('v-')
  }
  isEventName(attrName){
    return attrName.startsWith('@')
  }
  compileElement(node) {
    // console.log(node);
    //<div v-text='msg'></div>
    const attributes = node.attributes;
    // console.log(attributes);
    [...attributes].forEach(attr => {
      // console.log(attr);
      const { name, value } = attr;
      // console.log(name,value);
      if (this.isDirective(name)) { // 是否是指令
        // console.log(name);
        const [, directive] = name.split('-'); // text html moal on:click bind:src
        const [dirName, eventName] = directive.split(':') // text html model on 
        //更新数据  数据驱动试图
        compileUtil[dirName](node, value, this.vm, eventName)
        // 删除指令的标签上的属性
        node.removeAttribute('v-' + directive)
      }else if(this.isEventName(name)){ //@click
        let [,eventName] = name.split('@')
        compileUtil['on'](node, value, this.vm, eventName)
      }
    })
  }
  compileText(node) {
    const content = node.textContent;
    if (/\{\{(.*?)\}\}/g.test(content)) {
      // console.log(content);
      compileUtil['text'](node, content, this.vm)
    }
  }
}


class MVue {
  constructor(options) {
    this.$el = options.el;
    this.$data = options.data;
    this.$options = options;
    if (this.$el) {
      // 1. 实现一个数据的观察者
      new Observer(this.$data);
      // 2. 实现一个指令的解析器
      new Compile(this.$el, this);
      this.proxyData(this.$data)
    }
  }
  proxyData(data){
    for (const key in data){
      Object.defineProperty(this,key, {
        get(){
          return data[key]
        },
        set(newVal){
          console.log(newVal);
          data[key] = newVal
        }
      })
    }
  }
}