/*** Define parameters and tools ***/
var width = 600,
    height = 600,
    outerRadius = Math.min(width, height) / 2 - 100,
    innerRadius = outerRadius - 18;

var dataset = "#all_trips";
//string url for the initial data set
//would usually be a file path url, here it is the id
//selector for the <pre> element storing the data

//create number formatting functions
var formatPercent = d3.format("%");
var numberWithCommas = d3.format("0,f");

//create the arc path data generator for the groups
var arc = d3.svg.arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

//create the chord path data generator for the chords
var path = d3.svg.chord()
    .radius(innerRadius);

//define the default chord layout parameters
//within a function that returns a new layout object;
//that way, you can create multiple chord layouts
//that are the same except for the data.
function getDefaultLayout() {
    return d3.layout.chord()
    .padding(0.03)
    .sortSubgroups(d3.descending)
    .sortChords(d3.ascending);
}  
var last_layout; //store layout between updates
var neighborhoods; //store neighbourhood data outside data-reading function

/*** Initialize the visualization ***/
var g = d3.select("#chart_placeholdernew").append("svg")
        .attr("width", width)
        .attr("height", height)
    .append("g")
        .attr("id", "circle")
        .attr("transform", 
              "translate(" + width / 2 + "," + height / 2 + ")");
//the entire graphic will be drawn within this <g> element,
//so all coordinates will be relative to the center of the circle

g.append("circle")
    .attr("r", outerRadius);
//this circle is set in CSS to be transparent but to respond to mouse events
//It will ensure that the <g> responds to all mouse events within
//the area, even after chords are faded out.

/*** Read in the neighbourhoods data and update with initial data matrix ***/
//normally this would be done with file-reading functions
//d3.csv and d3.json and callbacks, 
//instead we're using the string-parsing functions
//d3.csv.parse and JSON.parse, both of which return the data,
//no callbacks required.

/*
d3.csv("data/neighborhoods.csv", function(error, neighborhoodData) {

    if (error) {alert("Error reading file: ", error.statusText); return; }
    
    neighborhoods = neighborhoodData; 
        //store in variable accessible by other functions
        
*/
    neighborhoods = d3.csv.parse(d3.select("#neighborhoods").text());
    //instead of d3.csv

    updateChords(dataset); 
    //call the update method with the default dataset
    
//} ); //end of d3.csv function


/* Create OR update a chord layout from a data matrix */
function updateChords( datasetURL ) {
    
  /*  d3.json(datasetURL, function(error, matrix) {

    if (error) {alert("Error reading file: ", error.statusText); return; }
    
    */
    var matrix = JSON.parse( d3.select(datasetURL).text() );
        // instead of d3.json
    
    /* Compute chord layout. */
    layout = getDefaultLayout(); //create a new layout object
    layout.matrix(matrix);
 
    /* Create/update "group" elements */
    var groupG = g.selectAll("g.group")
        .data(layout.groups(), function (d) {
            return d.index; 
            //use a key function in case the 
            //groups are sorted differently between updates
        });
    
    groupG.exit()
        .transition()
            .duration(1500)
            .attr("opacity", 0)
            .remove(); //remove after transitions are complete
    
    var newGroups = groupG.enter().append("g")
        .attr("class", "group");
    //the enter selection is stored in a variable so we can
    //enter the <path>, <text>, and <title> elements as well

    
    //Create the title tooltip for the new groups
    newGroups.append("title");
    
    //Update the (tooltip) title text based on the data
    groupG.select("title")
        .text(function(d, i) {
            return numberWithCommas(d.value) 
                + " free-trade-agreement connection(s) is(are) with " 
                + neighborhoods[i].name;
        });

    //create the arc paths and set the constant attributes
    //(those based on the group index, not on the value)
    newGroups.append("path")
        .attr("id", function (d) {
            return "group" + d.index;
            //using d.index and not i to maintain consistency
            //even if groups are sorted
        })
        .style("fill", function (d) {
            return neighborhoods[d.index].color;
        });
    
    //update the paths to match the layout
    groupG.select("path") 
        .transition()
            .duration(1500)
            .attr("opacity", 0.5) //optional, just to observe the transition
        .attrTween("d", arcTween( last_layout ))
            .transition().duration(100).attr("opacity", 1) //reset opacity
        ;
    
    //create the group labels
    newGroups.append("svg:text")
        .attr("xlink:href", function (d) {
            return "#group" + d.index;
        })
        .attr("dy", ".35em")
        .attr("color", "#ff6600")
        
        .text(function (d) {
            return neighborhoods[d.index].name;
        })
        .attr('font-weight', 'bold')
        .attr("color", "#ff6600");

    //position group labels to match layout
    groupG.select("text")
        .transition()
            .duration(1500)
            .attr("transform", function(d) {
                d.angle = (d.startAngle + d.endAngle) / 2;
                //store the midpoint angle in the data object
                
                return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")" +
                    " translate(" + (innerRadius + 26) + ")" + 
                    (d.angle > Math.PI ? " rotate(180)" : " rotate(0)"); 
                //include the rotate zero so that transforms can be interpolated
            })
            .attr("text-anchor", function (d) {
                return d.angle > Math.PI ? "end" : "begin";
            });
    
    
    /* Create/update the chord paths */
    var chordPaths = g.selectAll("path.chord")
        .data(layout.chords(), chordKey );
            //specify a key function to match chords
            //between updates
        
    
    //create the new chord paths
    var newChords = chordPaths.enter()
        .append("path")
        .attr("class", "chord");
    
    // Add title tooltip for each new chord.
    newChords.append("title");
    
    // Update all chord title texts
    chordPaths.select("title")
        .text(function(d) {
            if (neighborhoods[d.target.index].name !== neighborhoods[d.source.index].name) {
                return [numberWithCommas(d.source.value),
                        " agreement connection from ",
                        neighborhoods[d.source.index].name,
                        " to ",
                        neighborhoods[d.target.index].name,
                        "\n",
                        numberWithCommas(d.target.value),
                        " agreement connection from ",
                        neighborhoods[d.target.index].name,
                        " to ",
                        neighborhoods[d.source.index].name
                        ].join(""); 
                    //joining an array of many strings is faster than
                    //repeated calls to the '+' operator, 
                    //and makes for neater code!
            } 
            else { //source and target are the same
                return numberWithCommas(d.source.value) 
                    + " agreement(s) is(are) from and to " 
                    + neighborhoods[d.source.index].name;
            }
        });

    //handle exiting paths:
    chordPaths.exit().transition()
        .duration(1500)
        .attr("opacity", 0)
        .remove();

    //update the path shape
    chordPaths.transition()
        .duration(1500)
        .attr("opacity", 0.5) //optional, just to observe the transition
        .style("fill", function (d) {
            return neighborhoods[d.source.index].color;
        })
        .attrTween("d", chordTween(last_layout))
        .transition().duration(100).attr("opacity", 1) //reset opacity
    ;

    //add the mouseover/fade out behaviour to the groups
    //this is reset on every update, so it will use the latest
    //chordPaths selection
    groupG.on("mouseover", function(d) {
        chordPaths.classed("fade", function (p) {
            //returns true if *neither* the source or target of the chord
            //matches the group that has been moused-over
            return ((p.source.index != d.index) && (p.target.index != d.index));
        });
    });
    //the "unfade" is handled with CSS :hover class on g#circle
    //you could also do it using a mouseout event:
    /*
    g.on("mouseout", function() {
        if (this == g.node() )
            //only respond to mouseout of the entire circle
            //not mouseout events for sub-components
            chordPaths.classed("fade", false);
    });
    */
    
    last_layout = layout; //save for next update
    
//  }); //end of d3.json
}

function arcTween(oldLayout) {
    //this function will be called once per update cycle
    
    //Create a key:value version of the old layout's groups array
    //so we can easily find the matching group 
    //even if the group index values don't match the array index
    //(because of sorting)
    var oldGroups = {};
    if (oldLayout) {
        oldLayout.groups().forEach( function(groupData) {
            oldGroups[ groupData.index ] = groupData;
        });
    }
    
    return function (d, i) {
        var tween;
        var old = oldGroups[d.index];
        if (old) { //there's a matching old group
            tween = d3.interpolate(old, d);
        }
        else {
            //create a zero-width arc object
            var emptyArc = {startAngle:d.startAngle,
                            endAngle:d.startAngle};
            tween = d3.interpolate(emptyArc, d);
        }
        
        return function (t) {
            return arc( tween(t) );
        };
    };
}

function chordKey(data) {
    return (data.source.index < data.target.index) ?
        data.source.index  + "-" + data.target.index:
        data.target.index  + "-" + data.source.index;
    
    //create a key that will represent the relationship
    //between these two groups *regardless*
    //of which group is called 'source' and which 'target'
}
function chordTween(oldLayout) {
    //this function will be called once per update cycle
    
    //Create a key:value version of the old layout's chords array
    //so we can easily find the matching chord 
    //(which may not have a matching index)
    
    var oldChords = {};
    
    if (oldLayout) {
        oldLayout.chords().forEach( function(chordData) {
            oldChords[ chordKey(chordData) ] = chordData;
        });
    }
    
    return function (d, i) {
        //this function will be called for each active chord
        
        var tween;
        var old = oldChords[ chordKey(d) ];
        if (old) {
            //old is not undefined, i.e.
            //there is a matching old chord value
            
            //check whether source and target have been switched:
            if (d.source.index != old.source.index ){
                //swap source and target to match the new data
                old = {
                    source: old.target,
                    target: old.source
                };
            }
            
            tween = d3.interpolate(old, d);
        }
        else {
            //create a zero-width chord object
            var emptyChord = {
                source: { startAngle: d.source.startAngle,
                         endAngle: d.source.startAngle},
                target: { startAngle: d.target.startAngle,
                         endAngle: d.target.startAngle}
            };
            tween = d3.interpolate( emptyChord, d );
        }

        return function (t) {
            //this function calculates the intermediary shapes
            return path(tween(t));
        };
    };
}

/* Activate the buttons and link to data sets */
d3.select("#Button1990").on("click", function () {
    updateChords( "#men_tripsss" );
    //replace this with a file url as appropriate
    
    //enable other buttons, disable this one
    disableButton(this);
});

d3.select("#Button1994").on("click", function() {
    updateChords( "#men_tripss" );
    disableButton(this);
});
d3.select("#Button1998").on("click", function() {
    updateChords( "#men_trips" );
    disableButton(this);
});

d3.select("#Button2002").on("click", function() {
    updateChords( "#women_trips" );
    disableButton(this);
});
d3.select("#Button2006").on("click", function() {
    updateChords( "#all_tripsss" );
    disableButton(this);
});
d3.select("#Button2010").on("click", function() {
    updateChords( "#all_tripss" );
    disableButton(this);
});
d3.select("#Button2014").on("click", function() {
    updateChords( "#all_trips" );
    disableButton(this);
});
function disableButton(buttonNode) {
    d3.selectAll("button")
        .attr("disabled", function(d) {
            return this === buttonNode? "true": null;
        });
}
