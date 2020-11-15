//global js constants set from jekyll config data 

async function getDashRate(args) {
 

    try {
        let result = await $.ajax({
            type: "GET",
            url: `https://rates2.dashretail.org/rates?source=dashretail&symbol=dashusd`,
            data: "{}",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            timeout: 1500,
            cache: true,
        });
        return result;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

function appendLeadingZeroes(n){
    if(n <= 9){
      return "0" + n;
    }
    return n
  }
  
  
  
  


let DASHUSD =  Math.round({{ site.data.app.dash.dashusd }});
let DASH_UPDATED = "{{ site.data.app.dash.updated }}";

async function setDashRate(){
    try{
        let apiResult = await getDashRate();
        console.log('apiResult:');
        console.dir(apiResult);
        DASHUSD = Math.round(parseFloat(apiResult[0].price));
        let current_datetime = new Date()
        console.log(current_datetime.toString());
        const months = ["Jan", "Feb", "Mar","Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let formatted_date = `${appendLeadingZeroes(current_datetime.getDate())} ${months[current_datetime.getMonth()]}  ${current_datetime.getFullYear()} ${appendLeadingZeroes(current_datetime.getHours())}:${appendLeadingZeroes(current_datetime.getMinutes())}`
        DASH_UPDATED = formatted_date
    }
    catch(e){
        console.log("default to stored dash rate", e)
    }
}
$(document).ready(async function () {
    await setDashRate();
    $('#dash-price').text(DASHUSD);
    $('#dash-updated').text(DASH_UPDATED);

});



const TRELLO_API_KEY = '{{ site.data.app.trello.key }}';
const TRELLO_BOARD_ID = '{{ site.data.app.trello.board }}';
const TRELLO_LIST_ID_CONCEPTS = '{{ site.data.app.trello.concepts }}';
const TRELLO_LIST_ID_ARCHIVE = '{{ site.data.app.trello.archive }}';
const TRELLO_CUSTOM_ID_WORKTYPE = '{{ site.data.app.trello.customFieldWorkTypeId }}';
const TRELLO_CUSTOM_VALUE_WORKTYPE_PROJECT = '{{ site.data.app.trello.customFieldWorkTypeValueProject }}';
const TRELLO_CUSTOM_VALUE_WORKTYPE_SERVICE = '{{ site.data.app.trello.customFieldWorkTypeValueService }}';
const TRELLO_CUSTOM_VALUE_WORKTYPE_JOB = '{{ site.data.app.trello.customFieldWorkTypeValueJob }}';
const TRELLO_CUSTOM_ID_SKILLS = '{{ site.data.app.trello.customFieldSkillsId }}';
const TRELLO_CUSTOM_ID_PHASE = '{{ site.data.app.trello.customFieldPhaseId }}';
const TRELLO_CUSTOM_ID_LAST_PHASE = '{{ site.data.app.trello.customFieldLastPhaseId }}';
const TRELLO_CUSTOM_ID_COMPLETED = '{{ site.data.app.trello.customFieldCompletedId }}';
const TRELLO_CUSTOM_ID_SOURCE = '{{ site.data.app.trello.customFieldSourceId }}';
const TRELLO_CUSTOM_ID_WEBSITE = '{{ site.data.app.trello.customFieldWebsiteId }}';
const TRELLO_CUSTOM_ID_META = '{{ site.data.app.trello.customFieldMetaId }}';
const TRELLO_CUSTOM_ID_PAUSED = '{{ site.data.app.trello.customFieldPausedId }}';
const TRELLO_CUSTOM_ID_RATING = '{{ site.data.app.trello.customFieldRatingId }}';


