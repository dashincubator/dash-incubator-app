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
  
//get the dash price from dash retail API or fall back on value in _data/app/dash.yml 
let DASHUSD =  {{ site.data.app.dash.dashusd }};
let DASH_UPDATED = "{{ site.data.app.dash.updated }}";

async function setDashRate(){
    try{
        let apiResult = await getDashRate();
        console.log('apiResult:');
        console.dir(apiResult);
        DASHUSD = parseFloat(apiResult[0].price).toFixed(2);
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