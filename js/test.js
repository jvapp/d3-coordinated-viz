(function(){

    //variables for data join
    var attrArray = ["Food Insecurity Probability","Land Degradation", "Droughts probability and historical impact", "Political violence", "Human", "HAZARD", "Development & Deprivation", "Inequality", "Socio-Economic Vulnerability", "Uprooted people", "Health Conditions", "Children U5", "Malnutrition", "Food Security", "Other Vulnerable Groups", "Vulnerable Groups", "VULNERABILITY", "Communication", "Physical infrastructure", "Access to health care", "Infrastructure", "LACK OF COPING CAPACITY", "RISK"];
    var expressed = attrArray[0]; //initial attribute
    //console.log(expressed);

    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 473,
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scaleLinear()
    .range([463, 0])
    .domain([0, 10]);

    //begin script when window loads
    window.onload = setMap();

    //set up choropleth map
    function setMap(){

        //map frame dimensions
        var width = window.innerWidth * 0.5,
            height = 750;

        //create new svg container for the map
        var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

        //create Albers equal area conic projection centered on Sahel
        var projection = d3.geoAzimuthalEqualArea()
        .center([2, 15])
        .rotate([-2, 0, 0])
        .scale(1450)
        .translate([width / 2, height / 2]);

        var path = d3.geoPath()
        .projection(projection);

        //use queue to parallelize asynchronous data loading
        d3.queue()
            .defer(d3.csv, "data/SahelINFORM.csv") //load attributes from csv
            .defer(d3.json, "data/AfricaCountries.topojson") //load continental Africa map
            .defer(d3.json, "data/Sahel.topojson") //load Sahelian Districts choropleth spatial data
            .await(callback);

        function callback(error, csvData, africa, sahel){ 

            //place graticule on the map
            setGraticule(map, path);

            //translate africa TopoJSON
            var africaCountries = topojson.feature(africa, africa.objects.AfricaCountries),
                sahelAdmin = topojson.feature(sahel, sahel.objects.Sahel).features;
            //console.log(sahelAdmin);
            //add Africa countries to map
            var countries = map.append("path")
            .datum(africaCountries)
            .attr("class", "countries")
            .attr("d", path)  

            //join csv data to GeoJSON enumeration units
            sahelAdmin = joinData(sahelAdmin, csvData);

            var colorScale = makeColorScale(csvData);

            //add enumeration units to the map
            setEnumerationUnits(sahelAdmin, map, path, colorScale);
            //add coordinated visualization to the map
            setChart(csvData, colorScale);

            createDropdown(csvData);

            //setLabel(props);
        };
    };

    //function to create color scale generator
    function setGraticule(map, path){
        //create graticule generator
        var graticule = d3.geoGraticule()
        .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude
        //create graticule background
        var gratBackground = map.append("path")
        .datum(graticule.outline()) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

        //create graticule lines
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines
    };

    function joinData(sahelAdmin, csvData){
        //loop through csv to assign each set of csv attribute values to geojson region
        for (var i=0; i<csvData.length; i++){
            var csvRegion = csvData[i]; //the current region
            var csvKey = csvRegion.NAME_1; //the CSV primary key

            //loop through geojson regions to find correct region
            for (var a=0; a<sahelAdmin.length; a++){

                var geojsonProps = sahelAdmin[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.NAME_1; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){

                    //assign all attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvRegion[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and            value to geojson properties
                    });
                };
            };
        };   
        return(sahelAdmin);
    };
    function setEnumerationUnits(sahelAdmin, map, path, colorScale){
        //...REGIONS BLOCK FROM PREVIOUS MODULE
        //add Sahel regions to map
        var regions = map.selectAll(".regions")
        .data(sahelAdmin)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "regions " + d.properties.NAME_1;
        })
        .attr("d", path) 
        //Example 1.7 line 13
        .style("fill", function(d){
            return choropleth(d.properties, colorScale);
        })
        .on("mouseover", function(d){
            highlight(d.properties);
        })
        .on("mouseout", function(d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);




        //below Example 2.2 line 16...add style descriptor to each path
        var desc = regions.append("desc")
        .text('{"stroke": "#000", "stroke-width": "0.5px"}');

    };
    function makeColorScale(data){
        var colorClasses = [
            "#D4B9DA",
            "#C994C7",
            "#DF65B0",
            "#DD1C77",
            "#980043"
        ];
        //create color scale generator
        var colorScale = d3.scaleThreshold()
        .range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i=0; i<data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };

        //cluster data using ckmeans clustering algorithm to create natural breaks
        var clusters = ss.ckmeans(domainArray, 5);
        //reset domain array to cluster minimums
        domainArray = clusters.map(function(d){
            return d3.min(d);
        });
        //remove first value from domain array to create class breakpoints
        domainArray.shift();

        //assign array of last 4 cluster minimums as domain
        colorScale.domain(domainArray);
        return colorScale;
    };
    //function to test for data value and return color
    function choropleth(props, colorScale){
        //make sure attribute value is a number
        var val = parseFloat(props[expressed]);
        //if attribute value exists, assign a color; otherwise assign gray
        if (typeof val == 'number' && !isNaN(val)){
            return colorScale(val);
        } else {
            return "#CCC";
        };
    };

    //function to create coordinated bar chart
    function setChart(csvData, colorScale){


        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

        //set bars for each province
        var bars = chart.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bar " + d.NAME_1;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .on("mouseover", highlight)
        .on("mouseout", dehighlight)
        .on("mousemove", moveLabel);



        //add style descriptor to each rect
        var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');

        //create a text element for the chart title
        var chartTitle = chart.append("text")
        .attr("x", 40)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text("Number of Variable " + expressed[0] + " in each region");

        //create vertical axis generator
        var yAxis = d3.axisLeft()
        .scale(yScale)


        //place axis
        var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

        //create frame for chart border
        var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

        //set bar positions, heights, and colors
        updateChart(bars, csvData.length, colorScale);

        //annotate bars with attribute value text
        //    var numbers = chart.selectAll(".numbers")
        //        .data(csvData)
        //        .enter()
        //        .append("text")
        //        .sort(function(a, b){
        //            return a[expressed]-b[expressed]
        //        })
        //        .attr("class", function(d){
        //            return "numbers " + d.NAME_1;
        //        })
        //        .attr("text-anchor", "middle")
        //        .attr("x", function(d, i){
        //            var fraction = chartWidth / csvData.length;
        //            return i * fraction + (fraction - 1) / 2;
        //        })
        //        .attr("y", function(d){
        //            return chartHeight - yScale(parseFloat(d[expressed])) + 15;
        //        })
        //        .text(function(d){
        //            return d[expressed];
        //        });

    };

    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData){
        //add select element
        var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });

        //add initial option
        var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });
    };

    //dropdown change listener handler
    function changeAttribute(attribute, csvData){
        //change the expressed attribute
        expressed = attribute;

        //recreate the color scale
        var colorScale = makeColorScale(csvData);

        var regions = d3.selectAll(".regions")
        .transition()
        .duration(100)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });

        //re-sort, resize, and recolor bars
        //in changeAttribute()...Example 1.5 line 15...re-sort bars
        var bars = d3.selectAll(".bar")
        //re-sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(500);

        updateChart(bars, csvData.length, colorScale);
    }; //end of changeAttribute()
    //function to position, size, and color bars in chart
    function updateChart(bars, n, colorScale){
        //position bars
        bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
            .attr("height", function(d, i){
            return 463 - yScale(parseFloat(d[expressed]));
        })
            .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
            .style("fill", function(d){
            return choropleth(d, colorScale);
        });

        //at the bottom of updateChart()...add text to chart title
        var chartTitle = d3.select(".chartTitle")
        .text(expressed + " index by province.");
    };

    //function to highlight enumeration units and bars
    function highlight(props){
        //change stroke
        var selected = d3.selectAll("." + props.NAME_1)
        .style("stroke", "blue")
        .style("stroke-width", "2");
        
        setLabel(props)
    };
    //function to reset the element style on mouseout
    function dehighlight(props){
        var selected = d3.selectAll("." + props.NAME_1)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

        function getStyle(element, styleName){
            var styleText = d3.select(element)
            .select("desc")
            .text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];
        }
        //remove info label
        d3.select(".infolabel")
            .remove(); 
    };

    //function to create dynamic label
    function setLabel(props){
        //label content
        var labelAttribute = "<h1>" + props[expressed] +
            "</h1><b>" + expressed + "</b>";

        //create info label div
        var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.NAME_1 + "_label")
        .attr("id", props.NAME_1 + "_label")
        .html(labelAttribute);

        var regionName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.NAME_1);
    };

    //function to move info label with mouse
    function moveLabel(){
        //get width of label
        var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

        //use coordinates of mousemove event to set label coordinates
        var x1 = d3.event.clientX + 10,
            y1 = d3.event.clientY - 75,
            x2 = d3.event.clientX - labelWidth - 10,
            y2 = d3.event.clientY + 25;

        //horizontal label coordinate, testing for overflow
        var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
        //vertical label coordinate, testing for overflow
        var y = d3.event.clientY < 75 ? y2 : y1; 

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };
})(); //last line of main.js