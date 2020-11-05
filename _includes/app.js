
jQuery.support.cors = true;

async function getTrelloAllData(args) {
    let result;

    try {
        result = await $.ajax({
            type: "GET",
            url: `https://api.trello.com/1/board/${TRELLO_BOARD_ID}/cards?checklists=all&fields=id,name,idList,shortUrl,desc&customFieldItems=true&members=true&member_fields=username&key=${TRELLO_API_KEY}`,
            data: "{}",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            cache: false,
        });

        return result;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

function transformTrelloData(data) {
    try {
        //got all card data
        //console.log('Got all card data:');
        console.dir(data);

        //remove any cards from the concepts list and archive list
        const listIdConcepts = TRELLO_LIST_ID_CONCEPTS;
        const listIdArchive = TRELLO_LIST_ID_ARCHIVE;

        let concepts = data.filter(item => item.idList == listIdConcepts).map(item=>{return {warningText: 'Concepts List - Excluded', cardName: item.name, cardUrl: item.shortUrl}});
        let archived = data.filter(item => item.idList == listIdArchive).map(item=>{return {warningText: 'Archived List - Excluded', cardName: item.name, cardUrl: item.shortUrl}});


        let removedConceptsAndArchived = data.filter(item => item.idList !== listIdConcepts && item.idList !== listIdArchive);

        let removedConceptsAndArchivedCount = removedConceptsAndArchived.length;

        //only get cards with checklists
        let noChecklists = removedConceptsAndArchived.filter(item => item.checklists.length === 0).map(item=>{return {warningText: 'No Checklists - Excluded', cardName: item.name, cardUrl: item.shortUrl}});;


        let withChecklists = removedConceptsAndArchived.filter(item => item.checklists.length > 0);



        //process checklist items into array of task objects
        let tasks = [];
        let cardWarnings = [];
        let taskWarnings = [];
        withChecklists.map(card => {
            console.log("processing...");
            let cardId = card.id;
            let cardName = card.name;
            let cardDesc = card.desc;
            let listId = card.idList;
            let cardUrl = card.shortUrl;
            let cardAdmin = null;
            if (card.members.length > 0) {
                cardAdmin = card.members[0].username;
            }
            else {
                cardWarnings.push({ warningText: 'No card admin set', cardName: card.name, cardUrl: card.shortUrl });

            }
            let cardCustomFields = processCustomFields(card.customFieldItems);

            if (cardCustomFields.workType == null) {
                cardWarnings.push({ warningText: 'No work type set', cardName: card.name, cardUrl: card.shortUrl });
            }

            if (cardCustomFields.skills == null) {
                cardWarnings.push({ warningText: 'No skills set', cardName: card.name, cardUrl: card.shortUrl });
            }



            card.checklists.map(checklist => {
                let ignoreBadTaskListName;
                let checklistName = checklist.name;
                //We don't need Concept Tasks
                if (checklistName != 'Production Tasks' &&
                    checklistName != 'Service Tasks' &&
                    checklistName != 'Job Tasks' &&
                    checklistName != 'Specification Tasks' &&
                    checklistName != 'QA Tasks') {
                    ignoreBadTaskListName = true;

                }
                checklist.checkItems.map(checklistItem => {

                    

                    let taskFatalErrors;

                    let taskId = checklistItem.id;
                    let checklistItemName = checklistItem.name;

                    if (ignoreBadTaskListName) {
                        taskWarnings.push({ warningText: `Has bad checklist item name (${checklistName}) - Not processed`, cardName: card.name, cardUrl: card.shortUrl, taskDesc: checklistItemName });
                        taskFatalErrors = true;

                    }


                    let parsedDesc = splitTaskDescription(checklistItemName);
                    console.log('parsedDesc', parsedDesc);
                    let taskNumber = parsedDesc.taskNumber;
                    if (taskNumber == null) {
                        taskWarnings.push({ warningText: `Task Number did not parse (${checklistName}) - Not processed`, cardName: card.name, cardUrl: card.shortUrl, taskDesc: checklistItemName });
                        taskFatalErrors = true;

                    }
                    let taskDesc = parsedDesc.taskDesc
                    if (taskDesc == null) {
                        taskWarnings.push({ warningText: `Task Description did not parse (${checklistName}) - Not processed`, cardName: card.name, cardUrl: card.shortUrl, taskDesc: checklistItemName });
                        taskFatalErrors = true;

                    }
                    //convert to USD 
                    //TODO: Use live rates
                    let dashAmountFloat = parsedDesc.taskRewardDash;
                    if (dashAmountFloat == null) {
                        taskWarnings.push({ warningText: `Task Amount did not parse (${checklistName}) - Not processed`, cardName: card.name, cardUrl: card.shortUrl, taskDesc: checklistItemName });
                        taskFatalErrors = true;

                    }
                    let dashUSDAmount = null;
                    if (dashAmountFloat !== null) {
                        //dashAmountFloat = parseFloat(extractedDashAmount);
                        //TODO error handling
                        dashUSDAmount = dashAmountFloat * DASHUSD;
                    }


                    //only bother adding if it doesn't have an assigned member
                    let checklistItemIdMember = checklistItem.idMember;
                    if (checklistItemIdMember != null) {
                        taskWarnings.push({ warningText: `Has an assigned member - Not shown`, cardName: card.name, cardUrl: card.shortUrl, taskDesc: checklistItemName });
                        taskFatalErrors = true;
                    }

                    if(taskFatalErrors){return;}

                    tasks.push({ taskId: taskId, taskNumber: taskNumber, cardId: cardId, cardName: cardName, cardDesc: cardDesc, listId: listId, cardUrl: cardUrl, admin: cardAdmin, workType: cardCustomFields.workType, cardSkills: cardCustomFields.skills, checklistName: checklistName, checklistItemName: checklistItemName, taskDesc: taskDesc, rewardDash: dashAmountFloat, rewardUSD: dashUSDAmount });

                })
                //}
                /*
                else{
                    cardWarnings.push({warningText: 'Concept tasks ignored', cardName: card.name, cardUrl:card.shortUrl});
                }
                */

            })

        })

        console.log('all Tasks:');
        console.dir(tasks);

        let totalTasks = tasks.length;
        console.log('total tasks:', totalTasks)

        //filter tasks to lists
        let lists = {}

        lists.project = tasks.filter(item => item.checklistName == 'Production Tasks' && item.workType == 'Project');
        lists.spec = tasks.filter(item => item.checklistName == 'Specification Tasks');
        lists.service = tasks.filter(item => item.checklistName == 'Production Tasks' && item.workType == 'Service');
        lists.job = tasks.filter(item => item.checklistName == 'Production Tasks' && item.workType == 'Job');
        lists.qa = tasks.filter(item => item.checklistName == 'QA Tasks');


        console.log('Lists:');
        console.dir(lists);

        return {
            lists: lists,
            debug: {
                concepts: concepts,
                archived: archived,
                removedListsCount: removedConceptsAndArchivedCount,
                noChecklists: noChecklists,
                warnings: { cardWarnings: cardWarnings, taskWarnings: taskWarnings }

            }
        };

    } catch (e) {
        console.error(e);
        throw e;
    }

}



function processCustomFields(arrCustomFields) {
    //accepts an array of custom fields from card data
    //returns an object containing Work Type & Skills
    //constants for custom fields
    const customFieldWorkTypeId = TRELLO_CUSTOM_ID_WORKTYPE;
    const customFieldWorkTypeValueProject = TRELLO_CUSTOM_VALUE_WORKTYPE_PROJECT;
    const customFieldWorkTypeValueService = TRELLO_CUSTOM_VALUE_WORKTYPE_SERVICE;
    const customFieldWorkTypeValueJob = TRELLO_CUSTOM_VALUE_WORKTYPE_JOB;

    const customFieldSkillsId = TRELLO_CUSTOM_ID_SKILLS;

    let customFields = {};

    //get workType
    arrCustomFields.filter(field => field.idCustomField == customFieldWorkTypeId)
        .map(value => {
            switch (value.idValue) {
                case customFieldWorkTypeValueProject:
                    customFields.workType = 'Project'
                    break;
                case customFieldWorkTypeValueService:
                    customFields.workType = 'Service'
                    break;
                case customFieldWorkTypeValueJob:
                    customFields.workType = 'Job'
                    break;
                default: customFields.workType = null;
            }
        });

    //get Skills

    filterSkills = arrCustomFields.filter(field => field.idCustomField == customFieldSkillsId)
    if (filterSkills.length > 0) {
        filterSkills.map(value => {
            customFields.skills = value.value.text;
        });
    }
    else {
        customFields.skills = null;
    }
    return customFields;

}


function splitTaskDescription(strTaskDescription) {


    try {

        let firstRBracket = strTaskDescription.indexOf(")");

        //task number
        let taskNumber = null;

        let parseTaskNum = strTaskDescription.substr(0, firstRBracket)
        
        if ($.isNumeric(parseTaskNum)) {
            taskNumber= parseTaskNum;
        }
       

        //extracts Dash Reward amount from task description
        //get last parenthesised text
        let lastLBracket = strTaskDescription.lastIndexOf("(");
        //console.log('lastLBracket',lastLBracket);
        let lastRBracket = strTaskDescription.lastIndexOf(")");
        //console.log('lastRBracket',lastRBracket);


        let taskDesc = strTaskDescription.substr(firstRBracket + 1, lastLBracket - firstRBracket - 1).trim();

        //replace md links with html <a> link
        let elements = taskDesc.match(/\[.*?\)/g);
        if (elements != null && elements.length > 0) {
            for (el of elements) {
                let txt = el.match(/\[(.*?)\]/)[1];//get only the txt
                let url = el.match(/\((.*?)\)/)[1];//get only the link
                taskDesc = taskDesc.replace(el, '<a href="' + url + '" target="_blank">' + txt + '</a>')
            }
        }


        let lastBracketContent = strTaskDescription.substr(lastLBracket + 1, lastRBracket - lastLBracket - 1).trim().toUpperCase();
        //console.log('lastBracketContent',lastBracketContent);
        let posOfTextDash = lastBracketContent.indexOf("DASH");
        //console.log('posOfTextDash',posOfTextDash);
        let amountStr = lastBracketContent.substr(0, posOfTextDash).trim()
        //console.log('amountStr',amountStr);
        // TODO: $.isNumeric is DEPRECATED!
        // replace with pure JS implementation
        let amt = null
        if ($.isNumeric(amountStr)) {
            amt = parseFloat(amountStr);
        }
        return { taskNumber: taskNumber, taskDesc: taskDesc, taskRewardDash: amt }
    }
    catch (e) {
        console.log(e);
        //throw e
        return { taskNumber: null, taskDesc: null, rewardDash: null }

    }

}

/*
function extractReward(strTaskDescription) {
    //extracts Dash Reward amount from task description
    //get last parenthesised text
    let lastLBracket = strTaskDescription.lastIndexOf("(");
    //console.log('lastLBracket',lastLBracket);
    let lastRBracket = strTaskDescription.lastIndexOf(")");
    //console.log('lastRBracket',lastRBracket);
    let lastBracketContent = strTaskDescription.substr(lastLBracket + 1, lastRBracket - lastLBracket - 1).trim().toUpperCase();
    //console.log('lastBracketContent',lastBracketContent);
    let posOfTextDash = lastBracketContent.indexOf("DASH");
    //console.log('posOfTextDash',posOfTextDash);
    let amountStr = lastBracketContent.substr(0, posOfTextDash).trim()
    //console.log('amountStr',amountStr);
    // TODO: $.isNumeric is DEPRECATED!
    // replace with pure JS implementation
    if ($.isNumeric(amountStr)) {
        return amountStr;
    }
    else {
        return null;
    }

}
*/

function listToTable(tableId, projectHeaderName, data) {
    let strHTML = '';

    strHTML += `
    <table class="bounty-table" id="tbl_${tableId}">
                    <thead>
                        <tr>
                            <th>${projectHeaderName}</th>
                            <th>
                                Task #
                            </th>
                            <th>
                                Task Description
                            </th>
                            <th>Skills</th>
                            <th>Reward</th>
                        </tr>
                    </thead>
                    <tbody>
    `
    data.map(item => {
        //let link = `./bounty-detail.html?bountytaskid=${item.taskId}&bountytrellourl=${item.cardUrl}&bountyname=${item.checklistItemName}&bountycardname=${item.cardName}&bountycarddesc=${item.cardDesc}&bountyrewardusd=${item.rewardUSD}&bountyrewarddash=${item.rewardDash}&bountyadmin=${item.admin}&bountyworktype=${item.workType}`;
        let link = `./bounty-detail.html?taskid=${item.taskId}`;
        strHTML += `<tr><td><div>${item.cardName}</div></td><td><div>${item.taskNumber}</div></td><td><div>${item.taskDesc}</div></td><td><div>${item.cardSkills || ''}</div></td><td><div><a href="${link}" class="btn">${item.rewardDash} DASH ($${item.rewardUSD})</a></div></td></tr>`;
    });

    strHTML += `
                    </tbody>
                    </table>
    `

    return strHTML;



}

function urlParam(name) {
    var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results == null) {
        return null;
    }
    return decodeURI(results[1]) || 0;
}


function getTaskById(data, taskId) {
    taskData = data.filter(item => item.taskId == taskId);
    console.log(`data for task id ${taskId}`, taskData)
    return taskData
}

function bountyDetailInfo(workType) {
    //chnage link to rules depending on worktype
    let reservingAnchor = '221-reserving-a-task';
    let rulesAnchor = '';
    let linkText = '<a href="rules.html">Find out more about tasks</a>';
    switch (workType.toUpperCase()) {
        case 'SPEC':
            rulesAnchor = '32-specifications';
            linkText = `<a href="rules.html#${rulesAnchor}">creating specifications.</a>`;
            break;
        case 'PROJECT':
            rulesAnchor = '33-projects';
            linkText = `<a href="rules.html#${rulesAnchor}">and completing project tasks.</a>`;
            break;
        case 'SERVICE':
            rulesAnchor = '34-services';
            linkText = `<a href="rules.html#${rulesAnchor}">and completing service tasks.</a>`;
            break;
        case 'JOB':
            rulesAnchor = '35-jobs';
            linkText = `<a href="rules.html#${rulesAnchor}">and completing job tasks.</a>`;
            break;
        case 'QA':
            rulesAnchor = '36-qa';
            linkText = `<a href="rules.html#${rulesAnchor}">and completing QA tasks.</a>`;
            break;


    }

    let strInfoLink = `Learn more about <a href="rules.html#${reservingAnchor}">reserving tasks</a> and ${linkText}`
    return strInfoLink;
}

function warningsToTable(data, type) {
    let strHTML = '';

    strHTML += `
    <table class="" id="">
                    <thead>
                        <tr>
                            <th>Warning</th>
                            <th>
                                Card
                            </th>`
    if(type=='task'){
    strHTML += `
                            <th>
                                Task Description
                            </th>`
    }
    strHTML += `
                        </tr>
                    </thead>
                    <tbody>`
    
    data.map(item => {
        strHTML += `<tr><td>${item.warningText}</td><td><a href="${item.cardUrl}" target="_blank">${item.cardName}</a></td>`;
        if(type=='task'){
            strHTML += `<td>${item.taskDesc}</td>`;
        }
        strHTML += '</tr>'
    });
    strHTML += `
                    </tbody>
                    </table>
    `

    return strHTML;

}
