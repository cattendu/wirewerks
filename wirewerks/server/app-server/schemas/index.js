var datasheekLinkPrefix = "http://www.wirewerks.com/wp-content/uploads/";
var datasheeLinkSuffix = "-EN-C.pdf";

class Product
{
	constructor()
	{
		this.title = "Cable Assemblies";
		this.subTitle = "Fiber Optic";
		this.description = "Build your Fiber Optic Cable Assembly: Replace each letter with the required option.";
		this.shortDescription = "b";
		this.longDescription = "blah blah blah blah";
		this.notes = "Other options are available upon request: Connectors Cable Constructions Fire Ratings MPO Wiring Schemes Polish Staggered Leads";
		this.dataSheetLink = "PDS-0023"; //prefix + dataSheetLink + suffix
		this.part = "FA";
		this.partNumberSections = []; //possible zero
		this.icon = "section8.svg";
		this.section = 8;
	}
};

class PartNumberSection
{
	constructor()
	{
		this.partNumbers = [];
	}
};

class PartNumber
{
	constructor()
	{
		this.title = "FIBER TYPE";
		this.type = "A";  //this should tell us the colour needed.
		this.length = 1;
		this.partNumberChoices = [];
	}
};

class PartNumberChoice
{
	constructor()
	{
		this.important = "";
		this.description = "Single Mode OS2";
		this.shortDescription = "blah";
		this.finePrint = "example: if more than one blha blah";
		this.value = "1";
	}
};