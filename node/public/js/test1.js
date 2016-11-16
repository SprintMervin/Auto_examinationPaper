// 有个网友问了个问题，如下的html，为什么每次输出都是5，而不是点击每个p，就alert出对应的1，2，3，4，5。

function init() {
    var pAry = document.getElementsByTagName("p");
    for (var i = 0; i < pAry.length; i++) {
        pAry[i].onclick = function () {
            alert(i);
        }
    }
}


//     解决方式有两种，

// 1、将变量 i 保存给在每个段落对象（p）上
function init() {
    var pAry = document.getElementsByTagName("p");
    for (var i = 0; i < pAry.length; i++) {
        pAry[i].i = i;
        pAry[i].onclick = function () {
            alert(this.i);
        }
    }
}


// 2、将变量 i 保存在匿名函数自身
function init2() {
    var pAry = document.getElementsByTagName("p");
    for (var i = 0; i < pAry.length; i++) {
        (pAry[i].onclick = function () {
            alert(arguments.callee.i);
        }).i = i;
    }
}

// 再增加3种
//
// 3、加一层闭包，i以函数参数形式传递给内层函数
function init3() {
    var pAry = document.getElementsByTagName("p");
    for (var i = 0; i < pAry.length; i++) {
        (function (arg) {
            pAry[i].onclick = function () {
                alert(arg);
            };
        })(i);//调用时参数
    }
}


// 4、加一层闭包，i以局部变量形式传递给内存函数
function init4() {
    var pAry = document.getElementsByTagName("p");
    for (var i = 0; i < pAry.length; i++) {
        (function () {
            var temp = i;//调用时局部变量
            pAry[i].onclick = function () {
                alert(temp);
            }
        })();
    }
}

// 5、加一层闭包，返回一个函数作为响应事件（注意与3的细微区别）
function init5() {
    var pAry = document.getElementsByTagName("p");
    for (var i = 0; i < pAry.length; i++) {
        pAry[i].onclick = function (arg) {
            return function () {//返回一个函数
                alert(arg);
            }
        }(i);
    }
}


// 又有一种方法


// 6、用Function实现，实际上每产生一个函数实例就会产生一个闭包
function init6() {
    var pAry = document.getElementsByTagName("p");
    for (var i = 0; i < pAry.length; i++) {
        pAry[i].onclick = new Function("alert(" + i + ");");//new一次就产生一个函数实例
    }
}


// 再增加一种
// 7、用Function实现，注意与6的区别
function init7() {
    var pAry = document.getElementsByTagName("p");
    for (var i = 0; i < pAry.length; i++) {
        pAry[i].onclick = Function('alert(' + i + ')')
    }
}
