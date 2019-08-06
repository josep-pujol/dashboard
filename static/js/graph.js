console.log('START')
queue()
    .defer(d3.csv, "data/Salaries.csv") // d3.csv method for the format of the data to load
    .await(makeGraphs);

function makeGraphs(error, salaryData) {
    console.log(salaryData);
    console.log(salaryData[10]);
    var ndx = crossfilter(salaryData);
    
    salaryData.forEach(function(d) {    // the numbers are stored like text. Here we convert them to integers
        d.yrs_since_phd = parseInt(d["yrs.since.phd"]);
        d.yrs_service = parseInt(d["yrs.service"]);
        d.salary = parseInt(d.salary);
    })
    
    show_discipline_selector(ndx);
    
    show_percent_are_professors(ndx, "Female", "#percent-of-women-professors");
    show_percent_are_professors(ndx, "Male", "#percent-of-men-professors");
    
    show_gender_balance(ndx);
    show_average_salary(ndx);
    show_rank_distribution(ndx);
    
    show_service_to_salary_correlation(ndx);
    show_phd_to_salary_correlation(ndx);
    
    dc.renderAll();
}


function show_discipline_selector(ndx) {
    dim = ndx.dimension(dc.pluck("discipline"));
    group = dim.group()
    
    dc.selectMenu("#discipline-selector")
        .dimension(dim)
        .group(group);
}


function show_percent_are_professors(ndx, gender, element) {
    var percentageThatAreProf = ndx.groupAll().reduce(
        function (p, v) {
            if(v.sex === gender) {
                p.count++;
                if(v.rank === "Prof") {
                    p.are_prof++;
                }
            }
            return p;
        },
        
        function (p, v) {
            if(v.sex === gender) {
                p.count--;
                if(v.rank === "Prof") {
                    p.are_prof--;
                }
            }
            return p;
        },
        
        function () {
            return {count: 0, are_prof: 0};
        }
    );

    dc.numberDisplay(element)
        .formatNumber(d3.format(".2%"))
        .valueAccessor(function(d) {
            if(d.count == 0) {
                return 0;
            } else {
                return (d.are_prof / d.count);
            }
        })
        .group(percentageThatAreProf);
}



function show_gender_balance(ndx) {
    var dim = ndx.dimension(dc.pluck("sex"));
    var group = dim.group();
    
    dc.barChart("#gender-balance")
        .width(400)
        .height(300)
        .margins({top:10, right: 50, bottom: 30, left: 50})
        .dimension(dim)
        .group(group)
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .xAxisLabel("Gender")
        .yAxis().ticks(20);
}


function show_average_salary(ndx) {
    var dim = ndx.dimension(dc.pluck("sex"));
    
    function add_item(p, v) {                 // p accumulator or counter of elements. v is values or data items that we are adding or removing
        p.count++;                            // where is p defined ???
        p.total += v.salary;
        p.average = p.total / p.count;
        return p;
    }
    
    function remove_item(p, v) {
        p.count--;
        if(p.count == 0) {
            p.total = 0;
            p.average = 0;
        } else {
            p.total -= v.salary;
            p.average = p.total / p.count;
        }
        return p;
    }
    

    function initialise() {
        return {count: 0, total: 0, average: 0}
    }
    
    
    var averageSalaryByGender = dim.group().reduce(add_item, remove_item, initialise);  /// why it needs the add, remove, initialize ???
    
    dc.barChart("#average-salary")
        .width(400)
        .height(300)
        .margins({top:10, right: 50, bottom: 30, left: 50})
        .dimension(dim)
        .group(averageSalaryByGender)
        .valueAccessor(function(d) {            // We need to write a value accessor, because we've used a custom reducer, 
                                                // to specify which of those 3 values actually gets plotted
            return d.value.average.toFixed(2);  // limit to two decimals
        })
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .elasticY(true)
        .xAxisLabel("Gender")
        .yAxis().ticks(4);
}


function show_rank_distribution(ndx) {
    
    var dim = ndx.dimension(dc.pluck("sex"));
    
    
    function rankByGender (dimension, rank) {
        return dimension.group().reduce(
            
            function(p, v) {
                p.total++;
                if(v.rank == rank) {
                    p.match++;
                }
                return p;
            },
            
            
            function (p, v) {
                p.total--;
                if(v.rank == rank) {
                    p.match--;
                }
                return p;
            },
            
            
            function () {
                return {total: 0, match: 0};
            }
            
        );
    }
    
    var profByGender = rankByGender(dim, "Prof");
    var asstProfByGender = rankByGender(dim, "AsstProf");
    var assocProfByGender = rankByGender(dim, "AssocProf");

    // console.log(profByGender.all());
    
    dc.barChart("#rank-distribution")
        .width(400)
        .height(300)
        .dimension(dim)
        .group(profByGender, "Prof")
        .stack(asstProfByGender, "Asst Prof")
        .stack(assocProfByGender, "Assoc Prof")
        
        .valueAccessor(function(d) {    // We need to write a value accessor, because we've used a custom reducer, to specify which of those 3 values actually gets plotted
            if(d.value.total > 0) {     // The total part of the data structure, our value, is the total number of men or women that have been found.
                return (d.value.match / d.value.total) * 100; // the match is the number of those that are professors, assistant professors, associate professors. 
            } else {                                          // basically we are getting what percentatge of the total is the match
                return 0;
            }
        })
        
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .xAxisLabel("Gender")
        .legend(dc.legend().x(320).y(20).itemHeight(15).gap(5))
        .margins({top:10, right: 100, bottom: 30, left: 30});  // we give more room for the legend

}


function show_service_to_salary_correlation(ndx) {
    
    var genderColors = d3.scale.ordinal()
        .domain(["Female", "Male"])
        .range(["pink", "blue"]);
    
    var eDim = ndx.dimension(dc.pluck("yr_service"));
    var experienceDim = ndx.dimension(function(d) {
        return [d.yrs_service, d.salary, d.rank, d.sex];
    });
    
    var experienceSalaryGroup = experienceDim.group();
    
    var minExperience = eDim.bottom(1)[0].yrs_service;
    var maxExperience = eDim.top(1)[0].yrs_service;
    
    dc.scatterPlot("#service-salary")
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minExperience, maxExperience]))
        .brushOn(false)     // you can filter clicking on the dots of the chart
        .symbolSize(8)      // size of the dots in the chart
        .clipPadding(10)    // leave some space on top to separate from anything that is on top of it
        .xAxisLabel("Years of Service")
        .yAxisLabel("Salary")
        .title(function (d) {               // what is displayed if you hover over a dot
            return d.key[2] + "earned " + d.key[1];    // d.key[0] would display years of service
        })
        .colorAccessor(function(d){
            return d.key[3];
        })
        .colors(genderColors)
        .dimension(experienceDim)
        .group(experienceSalaryGroup)
        .margins({top:10, right: 50, bottom: 75, left: 75});        
}


function show_phd_to_salary_correlation(ndx) {
    
    var genderColors = d3.scale.ordinal()
        .domain(["Female", "Male"])
        .range(["pink", "blue"]);
    
    var pDim = ndx.dimension(dc.pluck("yr_since_phd"));
    var phdDim = ndx.dimension(function(d) {
        return [d.yrs_since_phd, d.salary, d.rank, d.sex];
    });
    
    var phdSalaryGroup = phdDim.group();
    
    var minPhd= pDim.bottom(1)[0].yrs_since_phd;
    var maxPhd = pDim.top(1)[0].yrs_since_phd;
    
    dc.scatterPlot("#phd-salary")
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minPhd, maxPhd]))
        .brushOn(false)     // you can filter clicking on the dots of the chart
        .symbolSize(8)      // size of the dots in the chart
        .clipPadding(10)    // leave some space on top to separate from anything that is on top of it
        .xAxisLabel("Years Since PhD")
        .yAxisLabel("Salary")
        .title(function (d) {               // what is displayed if you hover over a dot
            return d.key[2] + " earned " + d.key[1] + ", gender " + d.key[3];    // d.key[0] would display years of service
        })
        .colorAccessor(function(d){
            return d.key[3];
        })
        .colors(genderColors)
        .dimension(phdDim)
        .group(phdSalaryGroup)
        .margins({top:10, right: 50, bottom: 75, left: 75});         
}