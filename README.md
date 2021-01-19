通过 Proxy(defineProperty)来实现对数据的监听，通过给数据和方法形成一种绑定

1. 创建数据的监听者 **Observer**

1. 创建编译数据到页面 **Compile**

1. 两者的桥梁 **Watcher** 依赖收集器 **Dep**

# 创建监听者 (Observer)

1. vue2

   采用 `Object.defineProperty` 对 `data` 里面的数据递归便利（费时）对每个数据增加 getter 和 setter 进行劫持 重写了数组的方法，当调用数组方法时会触发更新，也会对数组中的每一项进行监控 从而达到监听数据的变化

   ```javascript
   class Observer {
     constructor(data) {
       this.observer(data);
     }
     observer(data) {
       if (data && typeof data === "object") {
         // console.log(Object.keys(data));
         Object.keys(data).forEach((key) => {
           this.defineReactive(data, key, data[key]);
         });
       }
     }
     defineReactive(obj, key, value) {
       //递归遍历
       this.observer(value);
       const dep = new Dep();
       Object.defineProperty(obj, key, {
         enumerable: true,
         configurable: false,
         get() {
           //订阅数据变化时，往dep中添加观察者
           // Dep.target && dep.addSub(Dep.target);
           return value;
         },
         set: (newVal) => {
           this.observer(newVal);
           if (newVal !== value) {
             value = newVal;
             //告诉dep通知变化
             //   dep.notify();
           }
         },
       });
     }
   }
   ```

1. vue3

   1. 首先得知道[Proxy](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy)：在对目标对象的操作之前提供了拦截，可以对外界的操作进行过滤和改写，修改某些操作的默认行为，这样我们可以不直接操作对象本身，而是通过操作对象的代理对象来间接来操作对象，达到预期的目的

      小 demo:

      ```javascript
      let obj = {
        name: { name: "hhh" },
        arr: ["吃", "喝", "玩"],
      };
      //proxy兼容性差 可以代理13种方法 get set
      //defineProperty 只对特定 的属性进行拦截

      let handler = {
        get(target, key) {
          //target就是obj key就是要取obj里面的哪个属性
          console.log("收集依赖");
          return target[key];
        },
        set(target, key, value) {
          console.log("触发更新");
          target[key] = value;
        },
      };

      let proxy = new Proxy(obj, handler);
      //通过代理后的对象取值和设置值
      proxy.arr;
      proxy.name = "123";
      ```

   Proxy 实现数据劫持

   ```javascript
       Observe(data) {
           const that = this;
           let handler = {
               get(target, property) {
                   return target[property];
               },
               set(target, key, value) {
                   // 修改数据
                   let res = Reflect.set(target, key, value);
                   // 通知变化 更改试图
                   // that.subscribe[key].map(item => {
                   //     item.update();
                   // });
                   return res;
               }
           }
           this.$data = new Proxy(data, handler);
       }
   ```

   [Reflect](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect)是一个内置的对象，它提供拦截 JavaScript 操作的方法。这些方法与 proxy handlers 的方法相同

# 创建编译数据到页面 (Compile)

把 el 里面的 dom 拿到 便利拿到每个元素放在[文档碎片](https://developer.mozilla.org/en-US/docs/Web/API/Document/createDocumentFragment)中, 通过正则获取文档碎片中的 变量 把 data 的值赋值到 文档碎片中 然后同意放到页面上

> 文档碎片： 一个容器，用于暂时存放创建的 dom 元素,每次对 dom 的操作都会触发"重排"（重新渲染界面，发生重绘或回流), 把多次的 dom 操作转成一次操作

```javascript
// 编译的方法 获取数据 编译到页面上
const compileUtil = {
  getVal(expr, vm) {
    const dataVm = typeof vm.$data === "function" ? vm.$data() : vm.$data;
    return expr.split(".").reduce((data, currentVal) => {
      return data[currentVal];
    }, dataVm);
  },
  setVal(expr, vm, inputVal) {
    const dataVm = typeof vm.$data === "function" ? vm.$data() : vm.$data;
    return expr.split(".").reduce((data, currentVal) => {
      data[currentVal] = inputVal;
    }, dataVm);
  },
  getContentVal(expr, vm) {
    return expr.replace(/\{\{(.*?)\}\}/g, (...args) => {
      return this.getVal(args[1], vm);
    });
  },
  text(node, expr, vm) {
    //expr: msg
    let value;
    if (expr.indexOf("{{") !== -1) {
      //处理双大括号
      value = expr.replace(/\{\{(.*?)\}\}/g, (...args) => {
        return this.getVal(args[1], vm);
      });
      // console.log(value);
    } else {
      value = this.getVal(expr, vm); //vm.$data()[expr];
    }

    this.updater.textUpdater(node, value);
  },
  html(node, expr, vm) {
    const value = this.getVal(expr, vm); //vm.$data()[expr];
    // new Watcher(vm, expr, (newVal)=>{
    //   this.updater.htmlUpdater(node, newVal)
    // })
    this.updater.htmlUpdater(node, value);
  },
  model(node, expr, vm) {
    const value = this.getVal(expr, vm); //vm.$data()[expr];
    //试图 =》 数据 =》 视图
    node.addEventListener("input", (e) => {
      this.setVal(expr, vm, e.target.value);
    });
    this.updater.modelUpdater(node, value);
  },
  on(node, expr, vm, eventName) {
    let fn = vm.$options.methods && vm.$options.methods[expr];
    node.addEventListener(eventName, fn.bind(vm), false);
  },
  updater: {
    textUpdater(node, value) {
      node.textContent = value;
    },
    htmlUpdater(node, value) {
      node.innerHTML = value;
    },
    modelUpdater(node, value) {
      node.value = value;
    },
  },
};

// 获取dom 获取需要编译的
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
    this.el.appendChild(fragment);
  }
  node2Fragment(el) {
    //创建文档碎片
    const f = document.createDocumentFragment();
    let firstChild;
    while ((firstChild = el.firstChild)) {
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
    [...childNodes].forEach((child) => {
      // console.log(child);
      if (this.isElementNode(child)) {
        // 是元素节点
        // 编译元素节点
        // console.log('元素节点',child);
        this.compileElement(child);
      } else {
        // 文本节点
        //编译文本节点
        // console.log('文本节点',child);
        this.compileText(child);
      }
      if (child.childNodes && child.childNodes.length) {
        this.compile(child);
      }
    });
  }
  isDirective(attrName) {
    return attrName.startsWith("v-");
  }
  isEventName(attrName) {
    return attrName.startsWith("@");
  }
  compileElement(node) {
    // console.log(node);
    //<div v-text='msg'></div>
    const attributes = node.attributes;
    // console.log(attributes);
    [...attributes].forEach((attr) => {
      // console.log(attr);
      const { name, value } = attr;
      // console.log(name,value);
      if (this.isDirective(name)) {
        // 是否是指令
        // console.log(name);
        const [, directive] = name.split("-"); // text html moal on:click bind:src
        const [dirName, eventName] = directive.split(":"); // text html model on
        //更新数据  数据驱动试图
        compileUtil[dirName](node, value, this.vm, eventName);
        // 删除指令的标签上的属性
        node.removeAttribute("v-" + directive);
      } else if (this.isEventName(name)) {
        //@click
        let [, eventName] = name.split("@");
        compileUtil["on"](node, value, this.vm, eventName);
      }
    });
  }
  compileText(node) {
    const content = node.textContent;
    if (/\{\{(.*?)\}\}/g.test(content)) {
      // console.log(content);
      compileUtil["text"](node, content, this.vm);
    }
  }
}
```

# 两者的桥梁 (Watcher) 依赖收集器 (Dep)

主要是在上面编译获取数据的时候实例化它 把编译的方法和这个数据对应上 存到依赖收集器dep里面 当数据发生变化的时候直接调用 刚刚对应的方法 改变试图

```javascript
        class Watcher {
        // 监听者
        // 这个实例 哪个字段 变化了执行啥方法
        constructor(vm, expr, cb) {
            this.vm = vm;
            this.expr = expr;
            this.cb = cb;
            this.oldValue = this.getOldVal();
        }
        getOldVal() {
            Dep.target = this;
            console.log("oldVal");
            const oldValue = compileUtil.getVal(this.expr, this.vm);
            console.log("oldVal ending");
            Dep.target = null;
            return oldValue;
        }
        update() {
            const newValue = compileUtil.getVal(this.expr, this.vm);
            if (newValue !== this.oldValue) {
                this.cb(newValue);
            }
        }
        }
```

dep 用来存储watcher 和当数据改变的时候 调用notify 给数据update 改变试图

```javascript
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
```
