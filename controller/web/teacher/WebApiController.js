/**
 * Created by HUI on 2017/2/22.
 */
const express = require('express')
    , router = express.Router()
    , mongoose = require('mongoose')
    , db = mongoose.connection
    , crypto = require('crypto')
    , Joi = require('joi')
    , Mock = require('mockjs')
    , Random = Mock.Random
    , async = require('async')
    , path = require("path")
    , multer = require('multer')
    , session = require('express-session')
    , cookieParser = require('cookie-parser')
    , User = mongoose.model('User')
    , Bank = mongoose.model('Bank')
    , Paper = mongoose.model('Paper')
    , createFile = require('../../../servers/creatFile')
    , randArray = require('../../../servers/utils/randArray').randArray
    , arrCheck = require('../../../servers/utils/arrCheck').arrCheck
    , calTips = require('../../../servers/utils/calTips').calTips
    , level_random = require('../../../servers/utils/level_random').level_random

router.use(cookieParser());
//设置服务器session
router.use(session({
    secret: '12345',
    name: 'testapp',   //这里的name值得是cookie的name，默认cookie的name是：connect.sid
    cookie: {maxAge: 24 * 60 * 60 * 1000},  //设置maxAge是ms，session和相应的cookie失效过期
    resave: false,
    saveUninitialized: true,
}));
//数组交集
function arrayIntersection(a, b) {
    var ai = 0, bi = 0;
    var result = new Array();
    while (ai < a.length && bi < b.length) {
        if (a[ai] < b[bi]) {
            ai++;
        }
        else if (a[ai] > b[bi]) {
            bi++;
        }
        else /* they're equal */ {
            result.push(a[ai]);
            ai++;
            bi++;
        }
    }
    return result;
}
Array.intersect = function () {
    var result = new Array();
    var obj = {};
    for (var i = 0; i < arguments.length; i++) {
        for (var j = 0; j < arguments[i].length; j++) {
            var str = arguments[i][j];
            if (!obj[str]) {
                obj[str] = 1;
            }
            else {
                obj[str]++;
                if (obj[str] == arguments.length) {
                    result.push(str);
                }
            }//end else
        }//end for j
    }//end for i
    return result;
}


function toPercent(point) {
    var str = Number(point * 100).toFixed(1);
    str += "%";
    return str;
}
function semblance(arr) {
    let paper_a_arr = []
    let paper_b_arr = []
    let zui = arr[1]
    let sem
    arr[0].forEach(function (element) {
        paper_a_arr.push(element._id)
    })
    for (let i = 1; i < arr.length; i++) {
        let _i = i
        arr[_i].forEach(function (element) {
            paper_b_arr.push(element._id)
        })
        let sameLength = Array.intersect(paper_a_arr, paper_b_arr)
        sameLength = sameLength.length / arr[0].length

        if (_i == 1) {
            sem = sameLength
        } else if (_i == arr.length - 1) {
            if (sameLength < sem) {
                sem = sameLength
                zui = arr[_i]
            }
            return [arr[0], zui, toPercent(sem)]
        } else {
            if (sameLength < sem) {
                sem = sameLength
                zui = arr[_i]
            }
        }
        paper_b_arr = []

    }
}

//设置全局科目
router.get('/selectSubject', function (req, res) {
    if (req.session.user.subject_default = req.query.subject_default) {
        res.redirect('/home');
    }
});
//录入题目
router.post('/bank/create', function (req, res) {

    let bank = new Bank({
        user_id: req.session.user.user_id,
        subject: req.body.subject,
        type: req.body.type,
        tips: req.body.tips,
        level: req.body.level,
        public: req.body.public,
        question: req.body.question,
        answer: req.body.answer,
        filepath: req.body.filepath,
    });

    bank.save(function (err, next) {
        if (err) {
            res.end('error', err);
            return next();
        } else {
            res.status(200).send({message: 'create success'});

        }

    })
});

//预览题目
router.get('/findQuestion/:q_id', function (req, res, next) {
    Bank.find({_id: req.params.q_id}, function (err, docs) {
        if (err) {
            res.end('err', err);
            return next();
        }

        res.status(200).send(docs);

    })

});

//删除题目
router.delete('/bank/:id/delete', function (req, res, next) {

    Bank.findOne({_id: req.params.id}, function (err, doc) {
        if (err) {
            res.end('err', err);
            return next();
        }

        doc.remove();
        res.status(200).send(doc);
    })
});

//修改题目
router.post('/bank/:id/update', function (req, res, next) {
    Bank.update({'_id': req.params.id}, {
        $set: {
            subject: req.body.subject,
            type: req.body.type,
            tips: req.body.tips,
            level: req.body.level,
            public: req.body.public,
            question: req.body.question,
            answer: req.body.answer,
            filepath: req.body.filepath,
        }
    }, function (err, next) {
        if (err) {
            res.end('err', err);
            return next();
        }
        res.status(200).send({message: ' update success'});

    })
});

//出卷
//Todo change main line to tips on base
//is redo!
router.post('/make_paper', function (req, res, next) {
    const user_id = req.session.user.user_id;
    // const user_id = '58bbf1b8fe3d19194b924a5e';
    // const subject_default = '计算机学科基础';
    const subject_default = req.session.user.subject_default;
    let tips = req.body.tips; //用户指定的知识点[array]
    let level = req.body.level; //用户指定的难度[string]
    let type_items = Object.keys(req.body.type_items); //用户指定的题型{object}
    let type_number = Object.values(req.body.type_items);
    let tip = [];//最终筛选出的每道题目的知识点[array]
    let type_num = [];//每个类型对应的题数[array]
    let total_length = 0; //试卷的总长度[string]
    let errorArr = [];//错误集合
    let isContinue = [];
    let reg = /^0.[1-9]+$/;
    let total_paper = [];//试卷零时集合
    let c_times = 5;
    //计算每种题型的数量，以及试题的总长度
    for (let i = 0; i < type_number.length; i++) {
        total_length = total_length + type_number[i]
    }

    for (let item in req.body.type_items) {
        let item1 = item;
        Bank.count({user_id: user_id, type: item1, subject: subject_default}, function (err, docs) {
            if (docs < req.body.type_items[item1]) {
                isContinue.push(item1 + '题目不足');
                type_num.push(req.body.type_items[item1]);
                if (type_num.length === 5) {
                    type_num = type_number;
                    // console.log(total_length)
                    for (let i = 0; i < c_times; i++) {
                        makePaper(i)
                    }
                }
            } else {
                type_num.push(req.body.type_items[item1]);
                if (type_num.length === 5) {
                    type_num = type_number;
                    // console.log(total_length)
                    for (let i = 0; i < c_times; i++) {
                        makePaper(i)
                    }
                }
            }
        })
    }

    function makePaper(cc_time) {
        let type1_list = [],//选择
            type2_list = [],//填空
            type3_list = [],//判断
            type4_list = [],//简答
            type5_list = [],//解答
            paper_list = [];//试卷
        if (isContinue.length > 0) {
            res.status(400).send({error: isContinue})
        }
        else if (tips.length == 0) {
            res.status(400).send({error: '未勾选任何知识点'})
        }
        else if (reg.test(level) == false) {
            res.status(400).send({error: '输入的难度指数不符合要求（0-1）'})
        }
        else if (total_length == 0) {
            res.status(400).send({error: '题目总数不能为0'})
        }
        else {
            //每个题型循环一次

            for (let i = 0; i < type_items.length; i++) {
                // console.log(type_items[i] + '：' + type_num[i])
                Bank.find(
                    {
                        tips: {$in: tips},
                        type: type_items[i],
                        user_id: user_id,
                        subject: subject_default
                    },
                    function (err, docs) {

                        //该题目类型不包含指定的任一知识点
                        if (docs.length === 0) {
                            console.log(type_items[i] + '不包含所选的任一知识点');
                            errorArr.push(type_items[i] + '不包含所选的任一知识点')
                            let select_finally = [];
                            select_finally.length = type_num[i];
                            paper_list = paper_list.concat(select_finally);
                            //出卷结束判定
                            if (paper_list.length == total_length) {

                                if (errorArr.length > 0) {
                                    res.status(400).send({
                                        error: errorArr
                                    });
                                }
                                else {
                                    total_paper.push(paper_list)
                                    if (total_paper.length == c_times - 1) {
                                        let now_data = semblance(total_paper)
                                        res.status(200).send({
                                            message: "ok",
                                            paper1: now_data[0],
                                            paper2: now_data[1],
                                            semblance: now_data[2],
                                            user_id: user_id,
                                            subject: subject_default,
                                            tips: req.body.tips,
                                            level: req.body.level,
                                        })
                                    }
                                }
                            }
                        }

                        else {
                            tip = calTips(docs, type_num[i]);//最终筛选出的知识点[知识点:知识点所需题目数量]

                            // 每个题型中每个知识点每个题目筛选出的process
                            for (let j = 0; j < tip.length; j++) {


                                let tipTmp = tip;//由于闭包转换临时变量
                                let tip_temp = (tipTmp[j].split(':'))[0];
                                let tip_num = (tipTmp[j].split(':'))[1];
                                let level_select = level_random(level);

                                Bank.find(
                                    {
                                        tips: tip_temp,
                                        type: type_items[i],
                                        level: level_select,
                                        user_id: user_id
                                    },
                                    function (err, docs) {
                                        if (docs.length > 0 && docs.length >= tip_num) {

                                            let select_finally = randArray(docs, tip_num);

                                            switch (type_items[i]) {
                                                case '选择题':
                                                    type1_list = type1_list.concat(select_finally);
                                                    break;
                                                case '填空题':
                                                    type2_list = type2_list.concat(select_finally);
                                                    break;
                                                case '判断题':
                                                    type3_list = type3_list.concat(select_finally);
                                                    break;
                                                case '简答题':
                                                    type4_list = type4_list.concat(select_finally);
                                                    break;
                                                case '解答题':
                                                    type5_list = type5_list.concat(select_finally);
                                                    break;
                                            }

                                            paper_list = paper_list.concat(select_finally);

                                            //出卷结束判定
                                            if (paper_list.length == total_length) {

                                                if (errorArr.length > 0) {
                                                    res.status(400).send({
                                                        error: errorArr
                                                    });
                                                }
                                                else {
                                                    total_paper.push(paper_list)
                                                    if (total_paper.length == c_times - 1) {
                                                        let now_data = semblance(total_paper)
                                                        res.status(200).send({
                                                            message: "ok",
                                                            paper1: now_data[0],
                                                            paper2: now_data[1],
                                                            semblance: now_data[2],
                                                            user_id: user_id,
                                                            subject: subject_default,
                                                            tips: req.body.tips,
                                                            level: req.body.level,
                                                        })
                                                    }
                                                }
                                            }

                                        }


                                        else if (docs.length > 0 && docs.length < tip_num) {
                                            let choose_temp = docs;
                                            switch (type_items[i]) {
                                                case '选择题':
                                                    type1_list = type1_list.concat(choose_temp);
                                                    break;
                                                case '填空题':
                                                    type2_list = type2_list.concat(choose_temp);
                                                    break;
                                                case '判断题':
                                                    type3_list = type3_list.concat(choose_temp);
                                                    break;
                                                case '简答题':
                                                    type4_list = type4_list.concat(choose_temp);
                                                    break;
                                                case '解答题':
                                                    type5_list = type5_list.concat(choose_temp);
                                                    break;
                                            }
                                            paper_list = paper_list.concat(choose_temp);
                                            Bank.find(
                                                {
                                                    tips: tip_temp,
                                                    type: type_items[i],
                                                    user_id: user_id,
                                                    subject: subject_default
                                                },
                                                function (err, docs) {
                                                    if (docs.length < (tip_num - choose_temp.length)) {
                                                        console.log('错误2');
                                                        errorArr.push(type_items[i] + '错误');
                                                        let select_finally = [];
                                                        select_finally.length = (tip_num - choose_temp.length)
                                                        paper_list = paper_list.concat(select_finally);
                                                        //出卷结束判定
                                                        if (paper_list.length == total_length) {

                                                            if (errorArr.length > 0) {
                                                                res.status(400).send({
                                                                    error: errorArr
                                                                });
                                                            }
                                                            else {
                                                                total_paper.push(paper_list)
                                                                if (total_paper.length == c_times - 1) {
                                                                    let now_data = semblance(total_paper)
                                                                    res.status(200).send({
                                                                        message: "ok",
                                                                        paper1: now_data[0],
                                                                        paper2: now_data[1],
                                                                        semblance: now_data[2],
                                                                        user_id: user_id,
                                                                        subject: subject_default,
                                                                        tips: req.body.tips,
                                                                        level: req.body.level,
                                                                    })
                                                                }

                                                            }
                                                        }
                                                    }
                                                    else {
                                                        let select_finally = randArray(docs, tip_num - choose_temp.length);
                                                        switch (type_items[i]) {
                                                            case '选择题':
                                                                type1_list = type1_list.concat(select_finally);
                                                                break;
                                                            case '填空题':
                                                                type2_list = type2_list.concat(select_finally);
                                                                break;
                                                            case '判断题':
                                                                type3_list = type3_list.concat(select_finally);
                                                                break;
                                                            case '简答题':
                                                                type4_list = type4_list.concat(select_finally);
                                                                break;
                                                            case '解答题':
                                                                type5_list = type5_list.concat(select_finally);
                                                                break;
                                                        }
                                                        paper_list = paper_list.concat(select_finally);
                                                        //出卷结束判定
                                                        if (paper_list.length == total_length) {

                                                            if (errorArr.length > 0) {
                                                                res.status(400).send({
                                                                    error: errorArr
                                                                });
                                                            }
                                                            else {
                                                                total_paper.push(paper_list)
                                                                if (total_paper.length == c_times - 1) {
                                                                    let now_data = semblance(total_paper)
                                                                    res.status(200).send({
                                                                        message: "ok",
                                                                        paper1: now_data[0],
                                                                        paper2: now_data[1],
                                                                        semblance: now_data[2],
                                                                        user_id: user_id,
                                                                        subject: subject_default,
                                                                        tips: req.body.tips,
                                                                        level: req.body.level,
                                                                    })
                                                                }

                                                            }
                                                        }

                                                    }


                                                })

                                        }

                                        else {
                                            Bank.find(
                                                {
                                                    tips: tip_temp,
                                                    type: type_items[i],
                                                    user_id: user_id,
                                                    subject: subject_default
                                                },
                                                function (err, docs) {
                                                    if (docs.length == 0) {
                                                        console.log('错误3');
                                                        errorArr.push(type_items[i] + '错误3');
                                                        let select_finally = [];
                                                        select_finally.length = tip_num;
                                                        paper_list = paper_list.concat(select_finally);
                                                        //出卷结束判定
                                                        if (paper_list.length == total_length) {

                                                            if (errorArr.length > 0) {
                                                                res.status(400).send({
                                                                    error: errorArr
                                                                });
                                                            }
                                                            else {
                                                                total_paper.push(paper_list)
                                                                if (total_paper.length == c_times - 1) {
                                                                    let now_data = semblance(total_paper)
                                                                    res.status(200).send({
                                                                        message: "ok",
                                                                        paper1: now_data[0],
                                                                        paper2: now_data[1],
                                                                        semblance: now_data[2],
                                                                        user_id: user_id,
                                                                        subject: subject_default,
                                                                        tips: req.body.tips,
                                                                        level: req.body.level,
                                                                    })
                                                                }
                                                            }
                                                        }
                                                    }
                                                    else {
                                                        let select_finally = randArray(docs, tip_num);
                                                        switch (type_items[i]) {
                                                            case '选择题':
                                                                type1_list = type1_list.concat(select_finally);
                                                                break;
                                                            case '填空题':
                                                                type2_list = type2_list.concat(select_finally);
                                                                break;
                                                            case '判断题':
                                                                type3_list = type3_list.concat(select_finally);
                                                                break;
                                                            case '简答题':
                                                                type4_list = type4_list.concat(select_finally);
                                                                break;
                                                            case '解答题':
                                                                type5_list = type5_list.concat(select_finally);
                                                                break;
                                                        }
                                                        paper_list = paper_list.concat(select_finally);
                                                        //出卷结束判定
                                                        if (paper_list.length == total_length) {

                                                            if (errorArr.length > 0) {
                                                                res.status(400).send({
                                                                    error: errorArr
                                                                });
                                                            }
                                                            else {

                                                                total_paper.push(paper_list)
                                                                if (total_paper.length == c_times - 1) {
                                                                    let now_data = semblance(total_paper)
                                                                    res.status(200).send({
                                                                        message: "ok",
                                                                        paper1: now_data[0],
                                                                        paper2: now_data[1],
                                                                        semblance: now_data[2],
                                                                        user_id: user_id,
                                                                        subject: subject_default,
                                                                        tips: req.body.tips,
                                                                        level: req.body.level,
                                                                    })
                                                                }


                                                            }
                                                        }

                                                    }

                                                })

                                        }
                                    })


                            }
                        }
                    })

            }
        }
    }


})

router.post('/semblance', function (req, res, next) {
    const user_id = req.session.user.user_id;
    // const user_id ='58bbf1b8fe3d19194b924a5e';
    // const subject_default = '计算机学科基础';
    const subject_default = req.session.user.subject_default;
    let paper_a_index = req.body.a;
    let paper_b_index = req.body.b;
    Paper.find(
        {
            user_id: user_id,
            subject: subject_default
        }, function (err, doc) {


            if (paper_a_index <= 0 || paper_b_index <= 0 || paper_a_index > doc.length || paper_b_index > doc.length) {
                res.status(400).send({
                    error: '所选试卷不存在'
                })
            }
            else {
                let paper_a = doc[doc.length - paper_a_index].data
                let paper_b = doc[doc.length - paper_b_index].data
                if (paper_a.length != paper_b.length) {
                    res.status(400).send({
                        error: '所选试卷不是同一标准'
                    })
                } else {
                    let paper_a_arr = []
                    let paper_b_arr = []
                    paper_a.forEach(function (element) {
                        paper_a_arr.push(element._id)
                    })
                    paper_b.forEach(function (element) {
                        paper_b_arr.push(element._id)
                    })
                    // console.log(paper_a_arr,paper_b_arr)
                    let sameLength = Array.intersect(paper_a_arr, paper_b_arr)

                    res.status(200).send({
                        semblance: toPercent(sameLength.length / paper_a.length),
                        semblance_arr: sameLength
                    })
                }
            }

        })


})

router.post('/make', function (req, res, next) {
    const data = req.body
    const data_temp =[data.paper1,data.paper2]
    const user_id = req.session.user.user_id;
    const subject_default = req.session.user.subject_default;
    let complete=[]
    for(i=0;i<2;i++){
        let index=i;
        let order="A"
        if(index==1){
            order="B"
        }else{
            order="A"
        }
        let papers = data_temp[index]
        let timestamp = new Date().getTime();
        let paper = new Paper({
            user_id: user_id,
            subject: subject_default,
            tips: data.tips,
            level: data.level,
            data: papers,
            date: timestamp,
            filename: user_id + timestamp +order+ ".docx"
        });
        paper.save(function (err, next) {
            if (err) {
                res.end('error', err);
                return next();
            }
            complete.push('ok')
            createFile.create(papers, timestamp, user_id,order);

        })
    }
    res.status(200).send({
        message: "ok",
        data: data,
    });
})

//造数据
router.get('/addtestdata', function (req, res, next) {
    let data = Mock.mock({
        'list|10000': [{
            user_id: user_id,
            "subject|1": ["物理", "高数", "英语"],
            "type|1": ["选择题", "判断题", "填空题", "简答题", "解答题"],
            tips: /知识点[0-4][0-9]/,
            "level|1": ["易", "中", "难"],
            "public|1": true,
            question: /题目[a-z]+[A-Z]+[1-9]/,
            answer: /答案[a-z]+[A-Z]+[1-9]/,
            filepath: '../uploads/avatar.jpeg'
        }]
    });
    Bank.collection.insert(data.list, onInsert);
    function onInsert(err, docs) {
        if (err) {
            res.end("error");
            return next();
        } else {
            res.status(200).send({message: "done"});
        }
    }

});


module.exports = router;
