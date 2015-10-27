@font-face {
    font-family: '<%= fontName %>';
    <% _.forEach(fontSrcs, function(src) { %>
    src: <%= src %>;
    <% }); %>
    font-weight: normal;
    font-style: normal;
}

@mixin <%= classPrefix %>mixin {
    font-family: '<%= fontName %>';
    -moz-osx-font-smoothing: grayscale;
    -webkit-font-smoothing: antialiased;
    font-style: normal;
    font-variant: normal;
    font-weight: normal;
    line-height: 1;
    speak: none;
    text-transform: none;
}

$<%= classPrefix %>map:(
<% _.forEach(glyphCodepointMap, function(codepoint, name) { %>
<%= name %>:'\<%= codepoint %>',
<% }); %>
);

/* For each key in the map, created an own class */
@each $name, $value in $<%= classPrefix %>map {
  .<%= classPrefix %>#{$name} {
    @include <%= classPrefix %>mixin;
    content: $value;
  }
}

@mixin <%= classPrefix %>include($position: before, $icon: false, $styles: true) {
    @if $position == both {
        $position: 'before, &:after';
    }
    // Either a :before or :after pseudo-element, or both, defaulting to :before
    &:#{$position} {
        @if $icon {
            // A particular icon has been specified
            content: "#{map-get($<%= classPrefix %>map, $icon)}";
        }
        @if $styles {
            // Supportive icon styles required
            font-family: '<%= fontName %>';
            -moz-osx-font-smoothing: grayscale;
            -webkit-font-smoothing: antialiased;
            font-style: normal;
            font-variant: normal;
            font-weight: normal;
            line-height: 1;
            speak: none;
            text-transform: none;
        }
        // Include any extra rules supplied for the pseudo-element
        @content;
    }
}