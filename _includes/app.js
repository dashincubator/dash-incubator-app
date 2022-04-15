
jQuery.support.cors = true;






async function getTrelloAllData(args) {
    let result = {};

    try {
        result.cards = await $.ajax({
            type: "GET",
            url: `https://api.trello.com/1/board/${TRELLO_BOARD_ID}/cards?checklists=all&fields=id,name,idList,shortUrl,desc&customFieldItems=true&members=true&member_fields=username&key=${TRELLO_API_KEY}`,
            data: "{}",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            cache: false,
        });

        result.members = await $.ajax({
            type: "GET",
            url: `https://api.trello.com/1/board/${TRELLO_BOARD_ID}/members?key=${TRELLO_API_KEY}`,
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

function transformTrelloData(data, options = {}) {
    try {
        //got all card data
        //console.log('Got all card data:');
        console.dir(data);

        //remove any cards from the concepts list and archive list
        // TODO - use card level flags instead eg completed, ? concept accepted
        const listIdConcepts = TRELLO_LIST_ID_CONCEPTS;
        const listIdArchive = TRELLO_LIST_ID_ARCHIVE; //this refers to completed tasks not archives

        //TODO - retreive / process actual arhived cards seperately

        let trelloCards = data.cards;
        let trelloMembers = data.members;

        let concepts = trelloCards.filter(item => item.idList == listIdConcepts).map(item => { return { warningText: 'Concepts List - Excluded', cardName: item.name, cardUrl: item.shortUrl } });

        // TODO: archived should retrieved actualk archived cards
        // this id for the complete list
        // use custom field complete item instead to filter complete cards
        // add another option tp retrived archived (trello= filter closed) cards
        // 
        //
        let completed = [];
        //let archived = trelloCards.filter(item => item.idList == listIdArchive).map(item => { return { warningText: 'Archived List - Excluded', cardName: item.name, cardUrl: item.shortUrl } });
        let removedConceptsAndArchived = trelloCards.filter(item => item.idList !== listIdConcepts);

        let removedConceptsAndArchivedCount = removedConceptsAndArchived.length;

        //only get cards with checklists
        //TODO - remove? - this might exclude concepts
        let noChecklists = removedConceptsAndArchived.filter(item => item.checklists.length === 0).map(item => { return { warningText: 'No Checklists - Excluded', cardName: item.name, cardUrl: item.shortUrl } });;


        let withChecklists = removedConceptsAndArchived.filter(item => item.checklists.length > 0);



        //process checklist items into array of task objects
        let cards = [];
        let tasks = [];

        let cardWarnings = [];
        let taskWarnings = [];
        withChecklists.map(card => {
            //console.log("processing...");
            //TODO: remove unnecessary assignments
            let cardFatalErrors;
            let cardId = card.id;
            let cardName = card.name;


            let cardDesc = nl2br(card.desc);

            //replace md links with html <a> link
            let elements = cardDesc.match(/\[.*?\)/g);
            if (elements != null && elements.length > 0) {
                for (el of elements) {
                    let txt = el.match(/\[(.*?)\]/)[1];//get only the txt
                    let url = el.match(/\((.*?)\)/)[1];//get only the link
                    cardDesc = cardDesc.replace(el, '<a href="' + url + '" target="_blank">' + txt + '</a>')
                }
            }

            let cardTrelloListId = card.idList;
            let cardUrl = card.shortUrl;




            let cardAdmin = null;
            if (card.members.length > 0) {
                cardAdmin = card.members[0].username;
            }
            else {
                cardWarnings.push({ warnLevel: 1, warningText: 'No card admin set', cardName: card.name, cardUrl: card.shortUrl });

            }
            let cardCustomFields = processCustomFields(card.customFieldItems);

            if (cardCustomFields.cardWorkType == null) {
                cardWarnings.push({ warnLevel: 1, warningText: 'No work type set', cardName: card.name, cardUrl: card.shortUrl });
            }

            if (cardCustomFields.skills == null) {
                cardWarnings.push({ warnLevel: 2, warningText: 'No skills set', cardName: card.name, cardUrl: card.shortUrl });
            }

            if (cardCustomFields.source == null) {
                cardWarnings.push({ warnLevel: 2, warningText: 'No source set', cardName: card.name, cardUrl: card.shortUrl });
            }

            if (cardCustomFields.website == null) {
                cardWarnings.push({ warnLevel: 2, warningText: 'No website set', cardName: card.name, cardUrl: card.shortUrl });
            }

            if (cardCustomFields.phase == null) {
                cardWarnings.push({ warnLevel: 3, warningText: 'No phase set', cardName: card.name, cardUrl: card.shortUrl });
            }

            if (cardCustomFields.LastPhase == null) {
                cardWarnings.push({ warnLevel: 3, warningText: 'No last phase set', cardName: card.name, cardUrl: card.shortUrl });
            }

            if (cardCustomFields.rating == null) {
                cardWarnings.push({ warnLevel: 3, warningText: 'No rating set', cardName: card.name, cardUrl: card.shortUrl });
            }

            if (cardCustomFields.paused == true) {
                cardWarnings.push({ warnLevel: 3, warningText: 'Card Marked as Paused', cardName: card.name, cardUrl: card.shortUrl });
                if (!options.showPausedCardBountyTasks) {
                    cardWarnings.push({ warnLevel: 3, warningText: 'Card Not Shown because it is marked as Paused', cardName: card.name, cardUrl: card.shortUrl });
                    cardFatalErrors = true;
                }
            }

            if (cardCustomFields.completed == true) {
                cardWarnings.push({ warnLevel: 3, warningText: 'Card Marked as Completed', cardName: card.name, cardUrl: card.shortUrl });
                if (!options.showCompletedCardBountyTasks) {
                    cardWarnings.push({ warnLevel: 3, warningText: 'Card Not Shown because it is marked as Completed', cardName: card.name, cardUrl: card.shortUrl });
                    cardFatalErrors = true;
                }
            }

            if (cardCustomFields.meta == true) {
                cardWarnings.push({ warnLevel: 3, warningText: 'Card Marked as Meta', cardName: card.name, cardUrl: card.shortUrl });
            }


            let cardData = {
                cardId, cardName, cardDesc, cardTrelloListId, cardUrl, cardAdmin,
                cardWorkType: cardCustomFields.workType, cardSkills: cardCustomFields.skills, cardSource: cardCustomFields.source,
                cardWebsite: cardCustomFields.website, cardPhase: cardCustomFields.phase, cardLastPhase: cardCustomFields.lastPhase,
                cardRating: cardCustomFields.rating, cardPaused: cardCustomFields.paused, cardCompleted: cardCustomFields.completed, cardMeta: cardCustomFields.meta

            };
            let cardTasks = [];




            card.checklists.map(checklist => {
                let ignoreBadTaskListName;
                let checklistName = checklist.name;
                let taskType = checklist.name.split(" ")[0].toUpperCase()
                //We don't need Concept Tasks
                if (checklistName != 'Production Tasks' &&
                    checklistName != 'Specification Tasks' &&
                    checklistName != 'QA Tasks') {
                    ignoreBadTaskListName = true;

                }
                checklist.checkItems.map(checklistItem => {



                    let taskFatalErrors;

                    let taskId = checklistItem.id;
                    let checklistItemName = checklistItem.name;

                    if (ignoreBadTaskListName) {
                        taskWarnings.push({ warnLevel: 1, warningText: `Has bad checklist item name (${checklistName}) - Not processed`, cardName: card.name, cardUrl: card.shortUrl, taskDesc: checklistItemName });
                        taskFatalErrors = true;

                    }


                    let parsedDesc = splitTaskDescription(checklistItemName);
                    //console.log('parsedDesc', parsedDesc);
                    let taskNumber = parsedDesc.taskNumber;
                    if (taskNumber == null) {
                        taskWarnings.push({ warnLevel: 1, warningText: `Task Number did not parse (${checklistName}) - Not processed`, cardName: card.name, cardUrl: card.shortUrl, taskDesc: checklistItemName });
                        taskFatalErrors = true;

                    }
                    let taskDesc = nl2br(parsedDesc.taskDesc)
                    if (taskDesc == null) {
                        taskWarnings.push({ warnLevel: 1, warningText: `Task Description did not parse (${checklistName}) - Not processed`, cardName: card.name, cardUrl: card.shortUrl, taskDesc: checklistItemName });
                        taskFatalErrors = true;

                    }
                    //convert to USD 
                    //TODO: Use live rates
                    let rewardDash = parsedDesc.taskRewardDash;
                    if (rewardDash == null) {
                        taskWarnings.push({ warnLevel: 1, warningText: `Task Amount did not parse (${checklistName}) - Not processed`, cardName: card.name, cardUrl: card.shortUrl, taskDesc: checklistItemName });
                        taskFatalErrors = true;

                    }
                    else {
                        rewardDash = rewardDash.toFixed(2)
                    }
                    let rewardUSD = null;
                    if (rewardDash !== null) {
                        //dashAmountFloat = parseFloat(extractedDashAmount);
                        //TODO error handling
                        rewardUSD = Math.round(rewardDash * DASHUSD);
                    }

                    //?filter completed tasks
                    let taskComplete = (checklistItem.state == "complete" ? true : false);
                    if (taskComplete) {
                        if (!options.showFinishedTasks) {
                            taskWarnings.push({ warnLevel: 3, warningText: `Task is finished - Not shown`, cardName: card.name, cardUrl: card.shortUrl, taskDesc: checklistItemName });
                            taskFatalErrors = true;
                        }
                    }


                    //?filter overdue tasks
                    let taskDue = checklistItem.due;




                    //only bother adding if it doesn't have an assigned member
                    let taskAssignedId = checklistItem.idMember;
                    let taskAssignedUsername = null;
                    if (taskAssignedId != null) {
                        taskAssignedUsername = data.members.filter(name => name.id == taskAssignedId)[0].username || null;
                        if (!options.showAssignedTasks) {
                            taskWarnings.push({ warnLevel: 3, warningText: `Has an assigned member - Not shown`, cardName: card.name, cardUrl: card.shortUrl, taskDesc: checklistItemName });
                            taskFatalErrors = true;
                        }
                    }

                    //Don't show tasks from paused bounty cards
                    if (cardData.cardPaused) {
                        if (!options.showPausedBountyTasks) {
                            taskWarnings.push({ warnLevel: 3, warningText: `The card status is paused - Task Not shown`, cardName: card.name, cardUrl: card.shortUrl, taskDesc: checklistItemName });
                            taskFatalErrors = true;
                        }
                    }

                    //Don't show tasks from paused bounty cards
                    if (cardData.cardCompleted) {
                        if (!options.showCompletedCardBountyTasks) {
                            taskWarnings.push({ warnLevel: 3, warningText: `The card status is completed - Task Not shown`, cardName: card.name, cardUrl: card.shortUrl, taskDesc: checklistItemName });
                            taskFatalErrors = true;
                        }
                    }




                    if (taskFatalErrors) { return; }

                    let taskData = { taskId, taskNumber, checklistName, taskType, checklistItemName, taskDesc, rewardDash, rewardUSD, taskAssignedId, taskAssignedUsername, taskDue, taskComplete }




                    //flat task data
                    tasks.push({ ...cardData, ...taskData });

                    //add to nested card tasks
                    cardTasks.push(taskData);

                })
                //}
                /*
                else{
                    cardWarnings.push({warningText: 'Concept tasks ignored', cardName: card.name, cardUrl:card.shortUrl});
                }
                */

            })

            //nested card data
            //console.log('CARD DATA', cardData);

            //push card data to debug info if commpeted cards are not included
            // ?? remove this & use logs above instead
            if (!options.showCompletedCardBountyTasks) { completed.push(card) }

            if (cardFatalErrors) { return; } //don't show completed / pauseed cards unless option are set to do so 
            cards.push({ ...cardData, cardTasks });

        })

        //console.log('all Tasks:');
        //console.dir(tasks);

        let totalTasks = tasks.length;
        console.log('total tasks:', totalTasks)

        //filter tasks to lists
        let lists = {}

        lists.project = tasks.filter(item => item.taskType == 'PRODUCTION' && item.cardWorkType == 'Project');
        lists.spec = tasks.filter(item => item.taskType == 'SPECIFICATION');
        lists.service = tasks.filter(item => item.taskType == 'PRODUCTION' && item.cardWorkType == 'Service');
        lists.job = tasks.filter(item => item.taskType == 'PRODUCTION' && item.cardWorkType == 'Job');
        lists.qa = tasks.filter(item => item.taskType == 'QA');


        //console.log('Lists:');
        //console.dir(lists);

        return {
            lists,
            cards,
            debug: {
                concepts,
                completed,
                removedListsCount: removedConceptsAndArchivedCount,
                noChecklists,
                warnings: { cardWarnings, taskWarnings }

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
    //global constants for custom fields
    //TODO - get a more effecient way to do this..!

    let customFields = {};

    //get cardWorkType
    arrCustomFields.filter(field => field.idCustomField == TRELLO_CUSTOM_ID_WORKTYPE)
        .map(value => {
            switch (value.idValue) {
                case TRELLO_CUSTOM_VALUE_WORKTYPE_PROJECT:
                    customFields.workType = 'Project'
                    break;
                case TRELLO_CUSTOM_VALUE_WORKTYPE_SERVICE:
                    customFields.workType = 'Service'
                    break;
                case TRELLO_CUSTOM_VALUE_WORKTYPE_JOB:
                    customFields.workType = 'Job'
                    break;
                default: customFields.workType = null;
            }
        });

    //get Skills
    filterSkills = arrCustomFields.filter(field => field.idCustomField == TRELLO_CUSTOM_ID_SKILLS)
    if (filterSkills.length > 0) {
        filterSkills.map(value => {
            customFields.skills = value.value.text;
        });
    }
    else {
        customFields.skills = null;
    }

    //get Phase
    filterPhase = arrCustomFields.filter(field => field.idCustomField == TRELLO_CUSTOM_ID_PHASE)
    if (filterPhase.length > 0) {
        filterPhase.map(value => {
            customFields.phase = value.value.number;
        });
    }
    else {
        customFields.phase = null;
    }

    //get Last Phase
    filterLastPhase = arrCustomFields.filter(field => field.idCustomField == TRELLO_CUSTOM_ID_LAST_PHASE)
    if (filterLastPhase.length > 0) {
        filterLastPhase.map(value => {
            customFields.lastPhase = value.value.number;
        });
    }
    else {
        customFields.lastPhase = null;
    }

    //get Rating
    filterRating = arrCustomFields.filter(field => field.idCustomField == TRELLO_CUSTOM_ID_RATING)
    if (filterRating.length > 0) {
        filterRating.map(value => {
            customFields.rating = parseFloat(value.value.number);
        });
    }
    else {
        customFields.rating = 0;
    }

    //get Source
    filterSource = arrCustomFields.filter(field => field.idCustomField == TRELLO_CUSTOM_ID_SOURCE)
    if (filterSource.length > 0) {
        filterSource.map(value => {
            customFields.source = value.value.text;
        });
    }
    else {
        customFields.source = null;
    }

    //get Website
    filterWebsite = arrCustomFields.filter(field => field.idCustomField == TRELLO_CUSTOM_ID_WEBSITE)
    if (filterWebsite.length > 0) {
        filterWebsite.map(value => {
            customFields.website = value.value.text;
        });
    }
    else {
        customFields.website = null;
    }

    //get Completed
    filterCompleted = arrCustomFields.filter(field => field.idCustomField == TRELLO_CUSTOM_ID_COMPLETED)
    if (filterCompleted.length > 0) {
        filterCompleted.map(value => {
            console.log('BOUNTy COMPLETE?', value.value.checked)
            customFields.completed = value.value.checked == "true";

        });
    }
    else {
        customFields.completed = false;
    }

    //get Paused
    filterPaused = arrCustomFields.filter(field => field.idCustomField == TRELLO_CUSTOM_ID_PAUSED)
    if (filterPaused.length > 0) {
        filterPaused.map(value => {
            customFields.paused = value.value.checked == "true"
        });
    }
    else {
        customFields.paused = false;
    }

    //get Meta
    filterMeta = arrCustomFields.filter(field => field.idCustomField == TRELLO_CUSTOM_ID_META)
    if (filterMeta.length > 0) {
        filterMeta.map(value => {
            customFields.meta = value.value.checked == "true";
        });
    }
    else {
        customFields.meta = false;
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
            taskNumber = parseTaskNum;
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
                            <th>Reward*</th>
                        </tr>
                    </thead>
                    <tbody>
    `
    if(data.length>0){
        data.map(item => {
            //let link = `./bounty-detail.html?bountytaskid=${item.taskId}&bountytrellourl=${item.cardUrl}&bountyname=${item.checklistItemName}&bountycardname=${item.cardName}&bountycarddesc=${item.cardDesc}&bountyrewardusd=${item.rewardUSD}&bountyrewarddash=${item.rewardDash}&bountyadmin=${item.admin}&bountycardWorkType=${item.cardWorkType}`;
            let link = `./bounty-detail.html?taskid=${item.taskId}`;


            strHTML += `<tr><td><div>${item.cardName}</div></td><td><div>${item.taskNumber}</div></td><td><div>${item.taskDesc}</div></td><td><div>${item.cardSkills || ''}</div></td><td><div><a href="${link}" class="btn">${item.rewardDash.toString().padStart(5, '%').replace(/%/g, '&nbsp;')} DASH ${(`($${item.rewardUSD.toString()})`).padEnd(7, '%').replace(/%/g, '&nbsp;')}</a></div></td></tr>`;
        });
    }
    else{
        strHTML += `<tr><td colspan="5">All ${projectHeaderName} Tasks are currently reserved (check again later)</td></tr>`
    }

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

function bountyDetailInfo(cardWorkType, taskType) {
    //chnage link to rules depending on cardWorkType
    let reservingAnchor = '221-reserving-a-task';
    let rulesAnchor = '';
    let linkText = '<a href="rules.html">Find out more about tasks</a>';
    switch (taskType.toUpperCase()) {
        case 'SPEC':
            rulesAnchor = '32-specifications';
            linkText = `<a href="rules.html#${rulesAnchor}">creating specifications.</a>`;
            break;
        case 'QA':
            rulesAnchor = '36-qa';
            linkText = `and <a href="rules.html#${rulesAnchor}">completing QA tasks.</a>`;
            break;
        case 'PRODUCTION':
            switch (cardWorkType.toUpperCase()) {
                case 'PROJECT':
                    rulesAnchor = '33-projects';
                    linkText = `and <a href="rules.html#${rulesAnchor}">completing project tasks.</a>`;
                    break;
                case 'SERVICE':
                    rulesAnchor = '34-services';
                    linkText = `and <a href="rules.html#${rulesAnchor}">completing service tasks.</a>`;
                    break;
                case 'JOB':
                    rulesAnchor = '35-jobs';
                    linkText = `and <a href="rules.html#${rulesAnchor}">completing job tasks.</a>`;
                    break;

            }
    }
    let strInfoLink;
    if (cardWorkType.toUpperCase() == 'JOB') {
        strInfoLink = `Learn more about ${linkText}`
    }
    else {
        strInfoLink = `Learn more about <a href="rules.html#${reservingAnchor}">reserving tasks</a> ${linkText}`
    }
    return strInfoLink;
}

function warningsToTable(data, type) {
    let strHTML = '';

    strHTML += `
    <table class="" id="">
                    <thead>
                        <tr>
                            <th>
                                Level
                            </th>
                            <th>
                                Warning
                            </th>
                            <th>
                                Card
                            </th>`
    if (type == 'task') {
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
        strHTML += `<tr class="warn-level-${item.warnLevel}"><td>${item.warnLevel}</td><td>${item.warningText}</td><td><a href="${item.cardUrl}" target="_blank">${item.cardName}</a></td>`;
        if (type == 'task') {
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


function nl2br(str) {
    return `${str}`.replace(/(?:\r\n|\r|\n)/g, '<br>');
}
